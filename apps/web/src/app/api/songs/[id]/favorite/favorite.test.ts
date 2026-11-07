import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    favorite: { upsert: vi.fn(), deleteMany: vi.fn() },
    song: { findUnique: vi.fn() },
  },
}))

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { POST, DELETE } from "./route"

function makeSession() {
  return { user: { id: "user-1", name: "Test", email: "t@t.com", role: "CHANTRE" } }
}
function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe("POST /api/songs/[id]/favorite", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(makeSession())
    mockPrisma.favorite.upsert.mockResolvedValue({})
    mockPrisma.song.findUnique.mockResolvedValue({ deletedAt: null })
  })

  it("404 (et non 500) pour un chant inconnu ou supprimé", async () => {
    mockPrisma.song.findUnique.mockResolvedValue(null)
    const res = await POST(new Request("http://localhost", { method: "POST" }), makeParams("nope"))
    expect(res.status).toBe(404)
    expect(mockPrisma.favorite.upsert).not.toHaveBeenCalled()
  })

  it("retourne 401 sans session", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(new Request("http://localhost"), makeParams("song-1"))
    expect(res.status).toBe(401)
  })

  it("appelle upsert et retourne isFavorite: true", async () => {
    const res = await POST(new Request("http://localhost"), makeParams("song-1"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.isFavorite).toBe(true)
    expect(mockPrisma.favorite.upsert).toHaveBeenCalledOnce()
  })
})

describe("DELETE /api/songs/[id]/favorite", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(makeSession())
    mockPrisma.favorite.deleteMany.mockResolvedValue({ count: 1 })
  })

  it("retourne 401 sans session", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await DELETE(new Request("http://localhost"), makeParams("song-1"))
    expect(res.status).toBe(401)
  })

  it("appelle deleteMany et retourne isFavorite: false", async () => {
    const res = await DELETE(new Request("http://localhost"), makeParams("song-1"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.isFavorite).toBe(false)
    expect(mockPrisma.favorite.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", songId: "song-1" } })
    )
  })
})
