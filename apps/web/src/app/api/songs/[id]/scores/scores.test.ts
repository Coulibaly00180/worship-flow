import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    song: { findUnique: vi.fn() },
    songScore: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  },
}))

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { GET, POST } from "./route"
import { GET as GET_ONE, PATCH, DELETE } from "./[scoreId]/route"

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

  it("enregistre la voix choisie à l'envoi d'un fichier", async () => {
    const fd = new FormData()
    fd.append("file", new File([PDF as BlobPart], "alto.pdf", { type: "application/pdf" }))
    fd.append("voice", "ALTO")
    const res = await POST(new Request("http://x", { method: "POST", body: fd }), params)
    expect(res.status).toBe(201)
    expect(mockPrisma.songScore.create.mock.calls.at(-1)?.[0].data).toMatchObject({ voice: "ALTO", kind: "FILE" })
  })

  it("400 pour une voix inconnue", async () => {
    const fd = new FormData()
    fd.append("file", new File([PDF as BlobPart], "x.pdf"))
    fd.append("voice", "BARYTON")
    expect((await POST(new Request("http://x", { method: "POST", body: fd }), params)).status).toBe(400)
  })

  it("crée une partition ABC (JSON) avec la position suivante", async () => {
    mockPrisma.songScore.findFirst.mockResolvedValue({ position: 2 })
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "ABC", title: "Soprano", voice: "SOPRANO", abc: "X:1\nK:C\nCDEF|" }),
      }),
      params,
    )
    expect(res.status).toBe(201)
    expect(mockPrisma.songScore.create.mock.calls.at(-1)?.[0].data).toMatchObject({
      kind: "ABC", voice: "SOPRANO", position: 3, mimeType: "text/vnd.abc", filename: "Soprano",
    })
  })

  it("400 pour une partition ABC vide ou sans titre", async () => {
    const post = (body: unknown) =>
      POST(new Request("http://x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), params)
    expect((await post({ kind: "ABC", title: "T", abc: "" })).status).toBe(400)
    expect((await post({ kind: "ABC", title: "  ", abc: "X:1" })).status).toBe(400)
  })

  it("PATCH : refuse de modifier le contenu d'un fichier PDF/image", async () => {
    mockPrisma.songScore.findFirst.mockResolvedValue({ id: "sc1", kind: "FILE" })
    const res = await PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ abc: "X:1" }) }), oneParams)
    expect(res.status).toBe(400)
    expect(mockPrisma.songScore.update).not.toHaveBeenCalled()
  })

  it("PATCH : modifie une partition ABC et recalcule la taille", async () => {
    mockPrisma.songScore.findFirst.mockResolvedValue({ id: "sc1", kind: "ABC" })
    mockPrisma.songScore.update.mockResolvedValue({ id: "sc1" })
    const res = await PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ abc: "X:1\nK:G", voice: "TENOR" }) }), oneParams)
    expect(res.status).toBe(200)
    expect(mockPrisma.songScore.update.mock.calls[0][0].data).toMatchObject({ abc: "X:1\nK:G", voice: "TENOR", size: 7 })
  })

  it("PATCH : 403 pour un LECTEUR", async () => {
    as("LECTEUR")
    expect((await PATCH(new Request("http://x", { method: "PATCH", body: "{}" }), oneParams)).status).toBe(403)
  })

  it("GET d'une partition ABC renvoie le texte brut", async () => {
    mockPrisma.songScore.findFirst.mockResolvedValue({ id: "sc1", kind: "ABC", abc: "X:1", data: null })
    const res = await GET_ONE(new Request("http://x"), oneParams)
    expect(res.headers.get("content-type")).toContain("text/plain")
    expect(await res.text()).toBe("X:1")
  })
})
