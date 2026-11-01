import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    servicePlan: { findUnique: vi.fn(), create: vi.fn() },
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
  backgroundConfig: null,
  deletedAt: null,
  items: [
    { kind: "SONG_BLOCK", songId: "s1", refId: "s1", refSubId: null, title: "A", content: null, notes: "Ton: Do", mediaPath: null, secondaryContent: null, backgroundConfig: null },
    { kind: "ANNOUNCEMENT_TEXT", songId: null, refId: null, refSubId: null, title: "B", content: "x", notes: null, mediaPath: null, secondaryContent: null, backgroundConfig: null },
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
    mockPrisma.servicePlan.findUnique
      .mockResolvedValueOnce(source) // source
      .mockResolvedValueOnce({ id: "autre" }) // conflit
    expect((await post({ date: "2026-12-06T00:00:00.000Z" })).status).toBe(409)
    expect(mockPrisma.servicePlan.create).not.toHaveBeenCalled()
  })

  it("copie tous les éléments, notes comprises, avec un ordre contigu", async () => {
    mockPrisma.servicePlan.findUnique.mockResolvedValueOnce(source).mockResolvedValueOnce(null)
    const res = await post({ date: "2026-12-06T00:00:00.000Z" })
    expect(res.status).toBe(201)
    const data = mockPrisma.servicePlan.create.mock.calls[0][0].data
    expect(data.title).toBe("Culte")
    expect(data.items.create.map((i: { order: number }) => i.order)).toEqual([0, 1])
    expect(data.items.create[0].notes).toBe("Ton: Do")
  })
})
