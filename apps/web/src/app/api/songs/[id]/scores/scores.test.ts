import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    song: { findUnique: vi.fn() },
    songScore: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  },
}))

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { GET, POST } from "./route"
import { GET as GET_ONE, DELETE } from "./[scoreId]/route"

const params = { params: Promise.resolve({ id: "s1" }) }
const oneParams = { params: Promise.resolve({ id: "s1", scoreId: "sc1" }) }

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])

function upload(bytes: Uint8Array, name = "partition.pdf") {
  const fd = new FormData()
  fd.append("file", new File([bytes as BlobPart], name, { type: "application/pdf" }))
  return POST(new Request("http://x", { method: "POST", body: fd }), params)
}

const as = (role: string) => mockAuth.mockResolvedValue({ user: { id: "u1", role } })

describe("scores API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    as("CHANTRE")
    mockPrisma.song.findUnique.mockResolvedValue({ id: "s1", deletedAt: null })
    mockPrisma.songScore.create.mockResolvedValue({ id: "sc1", filename: "partition.pdf", mimeType: "application/pdf", size: 8 })
  })

  it("401 sans session", async () => {
    mockAuth.mockResolvedValue(null)
    expect((await GET(new Request("http://x"), params)).status).toBe(401)
    expect((await upload(PDF)).status).toBe(401)
  })

  it("403 pour un LECTEUR à l'envoi et à la suppression", async () => {
    as("LECTEUR")
    expect((await upload(PDF)).status).toBe(403)
    expect((await DELETE(new Request("http://x"), oneParams)).status).toBe(403)
  })

  it("404 si le chant n'existe pas ou est supprimé", async () => {
    mockPrisma.song.findUnique.mockResolvedValue({ id: "s1", deletedAt: new Date() })
    expect((await upload(PDF)).status).toBe(404)
  })

  it("accepte un vrai PDF et enregistre le type détecté", async () => {
    const res = await upload(PDF)
    expect(res.status).toBe(201)
    const data = mockPrisma.songScore.create.mock.calls[0][0].data
    expect(data.mimeType).toBe("application/pdf")
    expect(data.uploadedById).toBe("u1")
  })

  it("415 pour un HTML déguisé en PDF", async () => {
    const res = await upload(new TextEncoder().encode("<html><script>alert(1)</script>"))
    expect(res.status).toBe(415)
    expect(mockPrisma.songScore.create).not.toHaveBeenCalled()
  })

  it("413 pour un fichier trop gros", async () => {
    const big = new Uint8Array(8 * 1024 * 1024 + 1)
    big.set(PDF)
    expect((await upload(big)).status).toBe(413)
  })

  it("nettoie le nom de fichier (pas de chemin)", async () => {
    await upload(PDF, "../../etc/passwd.pdf")
    expect(mockPrisma.songScore.create.mock.calls[0][0].data.filename).toBe("passwd.pdf")
  })

  it("sert le fichier avec le bon type et nosniff", async () => {
    mockPrisma.songScore.findFirst.mockResolvedValue({
      id: "sc1", filename: "é.pdf", mimeType: "application/pdf", size: 8, data: Buffer.from(PDF),
    })
    const res = await GET_ONE(new Request("http://x"), oneParams)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/pdf")
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
  })

  it("DELETE : 404 si la partition n'appartient pas à ce chant", async () => {
    mockPrisma.songScore.deleteMany.mockResolvedValue({ count: 0 })
    expect((await DELETE(new Request("http://x"), oneParams)).status).toBe(404)
    expect(mockPrisma.songScore.deleteMany).toHaveBeenCalledWith({ where: { id: "sc1", songId: "s1" } })
  })
})
