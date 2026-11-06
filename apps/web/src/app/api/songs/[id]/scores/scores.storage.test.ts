import { describe, it, expect, vi, beforeEach } from "vitest"

// Stockage objet (S3) activé : le fichier part dans le bucket, la base ne garde que la clé
const { mockAuth, mockPrisma, mockStorage } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    song: { findUnique: vi.fn() },
    songScore: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  },
  mockStorage: {
    objectStorageEnabled: vi.fn(() => true),
    newScoreKey: vi.fn(() => "scores/s1/key-1"),
    putScoreObject: vi.fn(),
    getScoreObject: vi.fn(),
    deleteScoreObject: vi.fn(),
  },
}))

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/scoreStorage", () => mockStorage)

import { POST } from "./route"
import { GET as GET_ONE, DELETE } from "./[scoreId]/route"

const params = { params: Promise.resolve({ id: "s1" }) }
const oneParams = { params: Promise.resolve({ id: "s1", scoreId: "sc1" }) }
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])

function upload() {
  const fd = new FormData()
  fd.append("file", new File([PDF as BlobPart], "p.pdf", { type: "application/pdf" }))
  return POST(new Request("http://x", { method: "POST", body: fd }), params)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockStorage.objectStorageEnabled.mockReturnValue(true)
  mockAuth.mockResolvedValue({ user: { id: "u1", role: "CHANTRE" } })
  mockPrisma.song.findUnique.mockResolvedValue({ id: "s1", deletedAt: null })
  mockPrisma.songScore.findFirst.mockResolvedValue(null)
  mockPrisma.songScore.create.mockResolvedValue({ id: "sc1" })
})

describe("partitions dans un stockage objet", () => {
  it("envoie le fichier dans le bucket et ne stocke que la clé en base", async () => {
    expect((await upload()).status).toBe(201)
    expect(mockStorage.putScoreObject).toHaveBeenCalledWith("scores/s1/key-1", expect.any(Uint8Array), "application/pdf")
    const data = mockPrisma.songScore.create.mock.calls[0][0].data
    expect(data.storageKey).toBe("scores/s1/key-1")
    expect(data.data).toBeNull()
  })

  it("supprime l'objet si l'enregistrement en base échoue (pas d'orphelin)", async () => {
    mockPrisma.songScore.create.mockRejectedValue(new Error("db down"))
    await expect(upload()).rejects.toThrow("db down")
    expect(mockStorage.deleteScoreObject).toHaveBeenCalledWith("scores/s1/key-1")
  })

  it("sert le fichier depuis le bucket", async () => {
    mockPrisma.songScore.findFirst.mockResolvedValue({
      id: "sc1", kind: "FILE", storageKey: "scores/s1/key-1", data: null, mimeType: "application/pdf", size: 8, filename: "p.pdf",
    })
    mockStorage.getScoreObject.mockResolvedValue(new Blob([PDF as BlobPart]).stream())
    const res = await GET_ONE(new Request("http://x"), oneParams)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/pdf")
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF)
  })

  it("404 si l'objet a disparu du bucket", async () => {
    mockPrisma.songScore.findFirst.mockResolvedValue({
      id: "sc1", kind: "FILE", storageKey: "k", data: null, mimeType: "application/pdf", size: 8, filename: "p.pdf",
    })
    mockStorage.getScoreObject.mockResolvedValue(null)
    expect((await GET_ONE(new Request("http://x"), oneParams)).status).toBe(404)
  })

  it("supprime aussi l'objet quand on supprime la partition", async () => {
    mockPrisma.songScore.findFirst.mockResolvedValue({ storageKey: "scores/s1/key-1" })
    mockPrisma.songScore.deleteMany.mockResolvedValue({ count: 1 })
    expect((await DELETE(new Request("http://x"), oneParams)).status).toBe(200)
    expect(mockStorage.deleteScoreObject).toHaveBeenCalledWith("scores/s1/key-1")
  })
})
