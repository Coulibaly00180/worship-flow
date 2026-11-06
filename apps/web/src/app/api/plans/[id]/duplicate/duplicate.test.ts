import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    servicePlan: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  },
}))

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { POST } from "./route"

const params = { params: Promise.resolve({ id: "p1" }) }
const post = (body: unknown) =>
  POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }), params)

const source = {
  id: "p1",
  title: "Culte",
  deletedAt: null,
  items: [
    { kind: "SONG_BLOCK", songId: "s1", title: "A", content: null, notes: "Ton: Do" },
    { kind: "ANNOUNCEMENT_TEXT", songId: null, title: "B", content: "x", notes: null },
  ],
}

describe("POST /api/plans/[id]/duplicate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "u", role: "RESPONSABLE_CHANTRE" } })
    mockPrisma.servicePlan.create.mockResolvedValue({ id: "p2" })
  })

  it("401 sans session", async () => {
    mockAuth.mockResolvedValue(null)
    expect((await post({ date: "2026-12-06T00:00:00.000Z" })).status).toBe(401)
  })

  it("403 pour un CHANTRE", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u", role: "CHANTRE" } })
    expect((await post({ date: "2026-12-06T00:00:00.000Z" })).status).toBe(403)
  })

  it("400 si date invalide", async () => {
    expect((await post({ date: "demain" })).status).toBe(400)
  })

  it("409 si la date est déjà prise", async () => {
    mockPrisma.servicePlan.findUnique.mockResolvedValueOnce(source)
    mockPrisma.servicePlan.findFirst.mockResolvedValueOnce({ id: "autre" }) // conflit
    expect((await post({ date: "2026-12-06T00:00:00.000Z" })).status).toBe(409)
    expect(mockPrisma.servicePlan.create).not.toHaveBeenCalled()
    // Seuls les plans non supprimés comptent
    expect(mockPrisma.servicePlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) })
    )
  })

  it("409 (et non 500) si la base refuse la date (création simultanée)", async () => {
    mockPrisma.servicePlan.findUnique.mockResolvedValueOnce(source)
    mockPrisma.servicePlan.findFirst.mockResolvedValueOnce(null)
    mockPrisma.servicePlan.create.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }))
    expect((await post({ date: "2026-12-06T00:00:00.000Z" })).status).toBe(409)
  })

  it("copie tous les éléments, notes comprises, avec un ordre contigu", async () => {
    mockPrisma.servicePlan.findUnique.mockResolvedValueOnce(source)
    mockPrisma.servicePlan.findFirst.mockResolvedValueOnce(null)
    const res = await post({ date: "2026-12-06T00:00:00.000Z" })
    expect(res.status).toBe(201)
    const data = mockPrisma.servicePlan.create.mock.calls[0][0].data
    expect(data.title).toBe("Culte")
    expect(data.items.create.map((i: { order: number }) => i.order)).toEqual([0, 1])
    expect(data.items.create[0].notes).toBe("Ton: Do")
  })
})
