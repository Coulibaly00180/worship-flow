import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockAuth, mockPrisma } = vi.hoisted(() => {
  const mockAuth = vi.fn()
  const mockPrisma = {
    song: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  }
  return { mockAuth, mockPrisma }
})

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { GET, PATCH, DELETE } from "./route"

function makeSession(role = "CHANTRE") {
  return { user: { id: "user-1", name: "Test", email: "t@t.com", role } }
}
function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

const baseSong = {
  id: "song-1",
  title: "Amazing Grace",
  artist: "John Newton",
  tags: null,
  album: null,
  year: null,
  language: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  blocks: [{ id: "b1", order: 0, type: "VERSE", title: "Couplet 1", content: "How sweet" }],
  favorites: [],
  learnings: [],
}

describe("GET /api/songs/[id]", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(makeSession())
    mockPrisma.song.findUnique.mockResolvedValue(baseSong)
  })

  it("retourne 401 sans session", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(new Request("http://localhost"), makeParams("song-1"))
    expect(res.status).toBe(401)
  })

  it("retourne 404 si chant introuvable", async () => {
    mockPrisma.song.findUnique.mockResolvedValue(null)
    const res = await GET(new Request("http://localhost"), makeParams("song-999"))
    expect(res.status).toBe(404)
  })

  it("retourne 404 si chant supprimé (deletedAt non null)", async () => {
    mockPrisma.song.findUnique.mockResolvedValue({ ...baseSong, deletedAt: new Date() })
    const res = await GET(new Request("http://localhost"), makeParams("song-1"))
    expect(res.status).toBe(404)
  })

  it("retourne le chant avec ses blocs", async () => {
    const res = await GET(new Request("http://localhost"), makeParams("song-1"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.title).toBe("Amazing Grace")
    expect(json.data.blocks).toHaveLength(1)
  })

  it("calcule isFavorite: true quand favori présent", async () => {
    mockPrisma.song.findUnique.mockResolvedValue({ ...baseSong, favorites: [{ userId: "user-1" }] })
    const res = await GET(new Request("http://localhost"), makeParams("song-1"))
    const json = await res.json()
    expect(json.data.isFavorite).toBe(true)
  })

  it("calcule isFavorite: false quand aucun favori", async () => {
    const res = await GET(new Request("http://localhost"), makeParams("song-1"))
    const json = await res.json()
    expect(json.data.isFavorite).toBe(false)
  })
})

describe("DELETE /api/songs/[id]", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(makeSession("ADMIN"))
    mockPrisma.song.findUnique.mockResolvedValue(baseSong)
    mockPrisma.song.update.mockResolvedValue({ ...baseSong, deletedAt: new Date() })
  })

  it("retourne 403 si pas ADMIN", async () => {
    mockAuth.mockResolvedValue(makeSession("CHANTRE"))
    const res = await DELETE(new Request("http://localhost"), makeParams("song-1"))
    expect(res.status).toBe(403)
  })

  it("retourne 404 si chant introuvable", async () => {
    mockPrisma.song.findUnique.mockResolvedValue(null)
    const res = await DELETE(new Request("http://localhost"), makeParams("song-99"))
    expect(res.status).toBe(404)
  })

  it("fait un soft delete et retourne 200", async () => {
    const res = await DELETE(new Request("http://localhost"), makeParams("song-1"))
    expect(res.status).toBe(200)
    expect(mockPrisma.song.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) })
    )
  })
})

describe("PATCH /api/songs/[id]", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(makeSession())
    mockPrisma.song.findUnique.mockResolvedValue(baseSong)
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        song: {
          update: vi.fn().mockResolvedValue(baseSong),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ ...baseSong, blocks: [] }),
        },
        songBlock: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
      }
      return fn(tx)
    })
  })

  it("retourne 400 si blocs vides fournis", async () => {
    const res = await PATCH(new Request("http://localhost", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks: [] }),
    }), makeParams("song-1"))
    expect(res.status).toBe(400)
  })

  it("retourne 404 si chant introuvable", async () => {
    mockPrisma.song.findUnique.mockResolvedValue(null)
    const res = await PATCH(new Request("http://localhost", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New title" }),
    }), makeParams("song-99"))
    expect(res.status).toBe(404)
  })

  it("met à jour et retourne 200", async () => {
    mockPrisma.song.findFirst.mockResolvedValue(null)
    const res = await PATCH(new Request("http://localhost", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New title" }),
    }), makeParams("song-1"))
    expect(res.status).toBe(200)
  })

  it("409 si le nouveau titre est pris par un autre chant actif", async () => {
    mockPrisma.song.findFirst.mockResolvedValue({ id: "song-2" })
    const res = await PATCH(new Request("http://localhost", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Pris" }),
    }), makeParams("song-1"))
    expect(res.status).toBe(409)
    expect(mockPrisma.song.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { title: "Pris", deletedAt: null, NOT: { id: "song-1" } } })
    )
  })

  it("400 (et non 500) sur un JSON invalide", async () => {
    const res = await PATCH(new Request("http://localhost", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: "nope",
    }), makeParams("song-1"))
    expect(res.status).toBe(400)
  })

  it("met à jour les blocs en place (les notes attachées ne sont pas effacées)", async () => {
    const songBlock = {
      findMany: vi.fn().mockResolvedValue([{ id: "b1" }, { id: "b2" }]),
      update: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    }
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        song: { update: vi.fn(), findUniqueOrThrow: vi.fn().mockResolvedValue(baseSong) },
        songBlock,
      })
    )
    const res = await PATCH(new Request("http://localhost", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks: [{ label: "Couplet", type: "VERSE", content: "Nouveau", order: 0 }] }),
    }), makeParams("song-1"))
    expect(res.status).toBe(200)
    expect(songBlock.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { order: 0, type: "VERSE", title: "Couplet", content: "Nouveau" },
    })
    // Seul le bloc en trop disparaît
    expect(songBlock.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["b2"] } } })
    expect(songBlock.createMany).not.toHaveBeenCalled()
  })
})
