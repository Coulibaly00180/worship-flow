import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockAuth, mockPrisma } = vi.hoisted(() => {
  const mockAuth = vi.fn()
  const mockPrisma = {
    song: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
  }
  return { mockAuth, mockPrisma }
})

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { GET, POST } from "./route"

function makeSession(role = "CHANTRE") {
  return { user: { id: "user-1", name: "Test", email: "t@t.com", role } }
}

const baseSong = {
  id: "song-1",
  title: "Amazing Grace",
  artist: "John Newton",
  tags: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  blocks: [],
  favorites: [],
  learnings: [],
}

describe("GET /api/songs", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(makeSession())
    mockPrisma.song.findMany.mockResolvedValue([baseSong])
  })

  it("retourne 401 sans session", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(new Request("http://localhost/api/songs"))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
  })

  it("retourne la liste des chants", async () => {
    const res = await GET(new Request("http://localhost/api/songs"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data).toHaveLength(1)
    expect(json.data[0].title).toBe("Amazing Grace")
  })

  it("ajoute isFavorite: false quand pas de favoris", async () => {
    const res = await GET(new Request("http://localhost/api/songs"))
    const json = await res.json()
    expect(json.data[0].isFavorite).toBe(false)
  })

  it("ajoute isFavorite: true quand favori présent", async () => {
    mockPrisma.song.findMany.mockResolvedValue([
      { ...baseSong, favorites: [{ userId: "user-1" }] },
    ])
    const res = await GET(new Request("http://localhost/api/songs"))
    const json = await res.json()
    expect(json.data[0].isFavorite).toBe(true)
  })

  it("recherche plein texte : restreint aux ids trouvés et les trie par pertinence", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ id: "song-2" }, { id: "song-1" }])
    mockPrisma.song.findMany.mockResolvedValue([
      { ...baseSong, id: "song-1", favorites: [], learnings: [] },
      { ...baseSong, id: "song-2", favorites: [], learnings: [] },
    ])
    const res = await GET(new Request("http://localhost/api/songs?q=gr%C3%A2ce"))
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1)
    expect(mockPrisma.song.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ["song-2", "song-1"] } }) })
    )
    const json = await res.json()
    expect(json.data.map((s: { id: string }) => s.id)).toEqual(["song-2", "song-1"])
  })

  it("applique les filtres favoris, partition et statut", async () => {
    await GET(new Request("http://localhost/api/songs?fav=1&scores=1&status=MASTERED"))
    expect(mockPrisma.song.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          favorites: { some: { userId: "user-1" } },
          scores: { some: {} },
          learnings: { some: { userId: "user-1", status: "MASTERED" } },
        }),
      })
    )
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled()
  })

  it("ignore un statut inconnu", async () => {
    await GET(new Request("http://localhost/api/songs?status=HACK"))
    const where = mockPrisma.song.findMany.mock.calls.at(-1)?.[0].where
    expect(where.learnings).toBeUndefined()
  })

  it("filtre par lettre quand letter est fourni", async () => {
    await GET(new Request("http://localhost/api/songs?letter=A"))
    expect(mockPrisma.song.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          title: expect.objectContaining({ startsWith: "A" }),
        }),
      })
    )
  })
})

describe("POST /api/songs", () => {
  const validPayload = {
    title: "Amazing Grace",
    blocks: [{ label: "Couplet 1", type: "VERSE", content: "How sweet the sound", order: 0 }],
  }

  beforeEach(() => {
    mockAuth.mockResolvedValue(makeSession())
    mockPrisma.song.findFirst.mockResolvedValue(null)
    mockPrisma.song.create.mockResolvedValue({ ...baseSong, blocks: [] })
  })

  it("retourne 401 sans session", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(new Request("http://localhost/api/songs", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validPayload),
    }))
    expect(res.status).toBe(401)
  })

  it("retourne 400 si titre manquant", async () => {
    const res = await POST(new Request("http://localhost/api/songs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks: [validPayload.blocks[0]] }),
    }))
    expect(res.status).toBe(400)
  })

  it("retourne 400 si aucun bloc", async () => {
    const res = await POST(new Request("http://localhost/api/songs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Song", blocks: [] }),
    }))
    expect(res.status).toBe(400)
  })

  it("retourne 409 si le titre existe déjà", async () => {
    mockPrisma.song.findFirst.mockResolvedValue(baseSong)
    const res = await POST(new Request("http://localhost/api/songs", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validPayload),
    }))
    expect(res.status).toBe(409)
  })

  it("crée le chant et retourne 201", async () => {
    const res = await POST(new Request("http://localhost/api/songs", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validPayload),
    }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(mockPrisma.song.create).toHaveBeenCalledOnce()
  })

  it("passe artist à Prisma quand fourni", async () => {
    await POST(new Request("http://localhost/api/songs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPayload, artist: "John Newton" }),
    }))
    expect(mockPrisma.song.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ artist: "John Newton" }) })
    )
  })
})
