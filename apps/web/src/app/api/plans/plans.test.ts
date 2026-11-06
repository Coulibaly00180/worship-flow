import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    servicePlan: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  },
}))

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { GET, POST } from "./route"

function makeAdmin() {
  return { user: { id: "admin-1", firstName: "Admin", lastName: "", username: "admin", name: "Admin", email: "a@a.com", role: "ADMIN" } }
}
function makeChantre() {
  return { user: { id: "user-1", firstName: "Jean", lastName: "Dupont", username: "jean", name: "Jean Dupont", email: "u@u.com", role: "CHANTRE" } }
}
function makeResponsable() {
  return { user: { id: "rc-1", firstName: "Marie", lastName: "K", username: "marie_k", name: "Marie K", email: "rc@a.com", role: "RESPONSABLE_CHANTRE" } }
}

const basePlan = {
  id: "plan-1", date: new Date("2026-05-01"), title: "Culte dominical",
  deletedAt: null, createdAt: new Date(), updatedAt: new Date(),
  _count: { items: 3 },
}

describe("GET /api/plans", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(makeChantre())
    mockPrisma.servicePlan.findMany.mockResolvedValue([basePlan])
  })

  it("retourne 401 sans session", async () => {
    mockAuth.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
  })

  it("retourne la liste pour un chantre", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data).toHaveLength(1)
  })
})

describe("POST /api/plans", () => {
  const validPayload = { date: "2026-05-01T10:00:00.000Z", title: "Culte" }

  function makeReq(body: unknown) {
    return new Request("http://localhost", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
  }

  beforeEach(() => {
    mockAuth.mockResolvedValue(makeAdmin())
    mockPrisma.servicePlan.findFirst.mockResolvedValue(null)
    mockPrisma.servicePlan.create.mockResolvedValue(basePlan)
  })

  it("retourne 401 sans session", async () => {
    mockAuth.mockResolvedValue(null)
    expect((await POST(makeReq(validPayload))).status).toBe(401)
  })

  it("retourne 403 si CHANTRE", async () => {
    mockAuth.mockResolvedValue(makeChantre())
    expect((await POST(makeReq(validPayload))).status).toBe(403)
  })

  it("retourne 201 si RESPONSABLE_CHANTRE", async () => {
    mockAuth.mockResolvedValue(makeResponsable())
    const res = await POST(makeReq(validPayload))
    expect(res.status).toBe(201)
  })

  it("retourne 400 (et non 500) sur un JSON invalide", async () => {
    mockAuth.mockResolvedValue(makeResponsable())
    const res = await POST(new Request("http://localhost/api/plans", { method: "POST", body: "{x" }))
    expect(res.status).toBe(400)
  })

  it("retourne 409 (et non 500) si la base refuse la date", async () => {
    mockAuth.mockResolvedValue(makeResponsable())
    mockPrisma.servicePlan.findFirst.mockResolvedValue(null)
    mockPrisma.servicePlan.create.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }))
    const res = await POST(new Request("http://localhost/api/plans", {
      method: "POST", body: JSON.stringify({ date: "2026-05-01T10:00:00.000Z" }),
    }))
    expect(res.status).toBe(409)
  })

  it("retourne 400 si date invalide", async () => {
    expect((await POST(makeReq({ date: "pas-une-date" }))).status).toBe(400)
  })

  it("retourne 409 si plan existant à cette date", async () => {
    mockPrisma.servicePlan.findFirst.mockResolvedValue(basePlan)
    expect((await POST(makeReq(validPayload))).status).toBe(409)
  })

  it("crée le plan et retourne 201", async () => {
    const res = await POST(makeReq(validPayload))
    expect(res.status).toBe(201)
    expect(mockPrisma.servicePlan.create).toHaveBeenCalledOnce()
  })
})
