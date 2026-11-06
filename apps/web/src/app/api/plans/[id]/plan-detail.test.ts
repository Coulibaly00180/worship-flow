import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    servicePlan: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    song: { count: vi.fn() },
    serviceItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { PATCH, DELETE } from "./route"
import { PUT } from "./items/route"

const params = { params: Promise.resolve({ id: "p1" }) }
const plan = { id: "p1", date: new Date("2026-05-03T00:00:00.000Z"), title: "Culte", deletedAt: null }
const req = (method: string, body: unknown) =>
  new Request("http://x", { method, body: typeof body === "string" ? body : JSON.stringify(body) })

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: "rc", role: "RESPONSABLE_CHANTRE" } })
  mockPrisma.servicePlan.findUnique.mockResolvedValue(plan)
  mockPrisma.servicePlan.findFirst.mockResolvedValue(null)
  mockPrisma.servicePlan.update.mockResolvedValue(plan)
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mockPrisma))
})

describe("PATCH /api/plans/[id]", () => {
  it("400 (et non 500) sur un JSON invalide", async () => {
    expect((await PATCH(req("PATCH", "{x"), params)).status).toBe(400)
  })

  it("409 si la nouvelle date est déjà prise par un plan actif", async () => {
    mockPrisma.servicePlan.findFirst.mockResolvedValue({ id: "p2" })
    const res = await PATCH(req("PATCH", { date: "2026-05-10T00:00:00.000Z" }), params)
    expect(res.status).toBe(409)
    expect(mockPrisma.servicePlan.update).not.toHaveBeenCalled()
  })

  it("garder la même date ne déclenche pas de contrôle de doublon", async () => {
    const res = await PATCH(req("PATCH", { date: plan.date.toISOString(), title: "Nouveau" }), params)
    expect(res.status).toBe(200)
    expect(mockPrisma.servicePlan.findFirst).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/plans/[id]", () => {
  it("404 (et non 500) pour un plan inconnu ou déjà supprimé", async () => {
    mockPrisma.servicePlan.updateMany.mockResolvedValue({ count: 0 })
    expect((await DELETE(req("DELETE", ""), params)).status).toBe(404)
  })

  it("supprime (soft-delete) un plan actif", async () => {
    mockPrisma.servicePlan.updateMany.mockResolvedValue({ count: 1 })
    expect((await DELETE(req("DELETE", ""), params)).status).toBe(200)
    expect(mockPrisma.servicePlan.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1", deletedAt: null } })
    )
  })
})

describe("PUT /api/plans/[id]/items", () => {
  it("400 si un élément référence un chant inconnu ou supprimé (au lieu d'une 500)", async () => {
    mockPrisma.song.count.mockResolvedValue(0)
    const res = await PUT(req("PUT", { items: [{ order: 0, kind: "SONG_BLOCK", songId: "fantome" }] }), params)
    expect(res.status).toBe(400)
    expect(mockPrisma.serviceItem.createMany).not.toHaveBeenCalled()
  })

  it("ignore les anciens champs (refId, mediaPath…) envoyés par un vieux client", async () => {
    mockPrisma.song.count.mockResolvedValue(1)
    const res = await PUT(
      req("PUT", { items: [{ order: 0, kind: "SONG_BLOCK", songId: "s1", mediaPath: "/x", refId: "s1" }] }),
      params,
    )
    expect(res.status).toBe(200)
    const data = mockPrisma.serviceItem.createMany.mock.calls[0][0].data
    expect(data[0]).not.toHaveProperty("mediaPath")
    expect(data[0]).not.toHaveProperty("refId")
  })
})
