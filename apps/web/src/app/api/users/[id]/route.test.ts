import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed") },
  hash: vi.fn().mockResolvedValue("hashed"),
}))

import { PATCH } from "./route"

const session = (id: string, role: string) => ({ user: { id, role } })
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const patch = (id: string, body: unknown) =>
  PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify(body) }), params(id))

describe("PATCH /api/users/[id] — escalade de privilèges", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.update.mockResolvedValue({ id: "t" })
  })

  it("401 sans session", async () => {
    mockAuth.mockResolvedValue(null)
    expect((await patch("t", { firstName: "A" })).status).toBe(401)
  })

  it("refuse à un gestionnaire de réinitialiser le mot de passe d'un ADMIN", async () => {
    mockAuth.mockResolvedValue(session("m1", "RESPONSABLE_CHANTRE"))
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" })
    const res = await patch("admin-1", { password: "nouveaumdp123" })
    expect(res.status).toBe(403)
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it("refuse à un gestionnaire de réinitialiser le mot de passe d'un CHANTRE", async () => {
    mockAuth.mockResolvedValue(session("m1", "RESPONSABLE_CHANTRE"))
    mockPrisma.user.findUnique.mockResolvedValue({ role: "CHANTRE" })
    expect((await patch("c1", { password: "nouveaumdp123" })).status).toBe(403)
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it("refuse à un gestionnaire de modifier l'email d'un ADMIN", async () => {
    mockAuth.mockResolvedValue(session("m1", "RESPONSABLE_CHANTRE"))
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" })
    expect((await patch("admin-1", { email: "evil@x.com" })).status).toBe(403)
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it("refuse à un gestionnaire de modifier un autre gestionnaire (rang égal)", async () => {
    mockAuth.mockResolvedValue(session("m1", "RESPONSABLE_CHANTRE"))
    mockPrisma.user.findUnique.mockResolvedValue({ role: "RESPONSABLE_CHANTRE" })
    expect((await patch("m2", { firstName: "X" })).status).toBe(403)
  })

  it("autorise un utilisateur à changer son propre mot de passe", async () => {
    mockAuth.mockResolvedValue(session("u1", "LECTEUR"))
    expect((await patch("u1", { password: "nouveaumdp123" })).status).toBe(200)
    expect(mockPrisma.user.update).toHaveBeenCalled()
  })

  it("autorise un ADMIN à réinitialiser le mot de passe d'autrui", async () => {
    mockAuth.mockResolvedValue(session("a1", "ADMIN"))
    mockPrisma.user.findUnique.mockResolvedValue({ role: "CHANTRE" })
    expect((await patch("c1", { password: "nouveaumdp123" })).status).toBe(200)
  })

  it("400 sur JSON invalide", async () => {
    mockAuth.mockResolvedValue(session("u1", "LECTEUR"))
    const res = await PATCH(new Request("http://x", { method: "PATCH", body: "{oops" }), params("u1"))
    expect(res.status).toBe(400)
  })
})
