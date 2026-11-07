import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("bcryptjs", () => {
  // « bon-mdp » est le seul mot de passe actuel valide dans ces tests
  const compare = vi.fn(async (plain: string) => plain === "bon-mdp")
  const hash = vi.fn().mockResolvedValue("hashed")
  return { default: { hash, compare }, hash, compare }
})

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

  it("autorise un utilisateur à changer son propre mot de passe avec le mot de passe actuel", async () => {
    mockAuth.mockResolvedValue(session("u1", "LECTEUR"))
    mockPrisma.user.findUnique.mockResolvedValue({ role: "LECTEUR", passwordHash: "h" })
    const res = await patch("u1", { password: "nouveaumdp123", currentPassword: "bon-mdp" })
    expect(res.status).toBe(200)
    expect((await res.json()).reauth).toBe(true)
    // Toutes les sessions existantes sont invalidées
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ passwordHash: "hashed", sessionVersion: { increment: 1 } }) })
    )
  })

  it("refuse de changer son propre mot de passe sans le mot de passe actuel", async () => {
    mockAuth.mockResolvedValue(session("u1", "LECTEUR"))
    mockPrisma.user.findUnique.mockResolvedValue({ role: "LECTEUR", passwordHash: "h" })
    expect((await patch("u1", { password: "nouveaumdp123" })).status).toBe(403)
    expect((await patch("u1", { password: "nouveaumdp123", currentPassword: "faux" })).status).toBe(403)
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it("exige aussi le mot de passe actuel pour un ADMIN sur son propre compte", async () => {
    mockAuth.mockResolvedValue(session("a1", "ADMIN"))
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN", passwordHash: "h" })
    expect((await patch("a1", { password: "nouveaumdp123" })).status).toBe(403)
  })

  it("autorise un ADMIN à réinitialiser le mot de passe d'autrui", async () => {
    mockAuth.mockResolvedValue(session("a1", "ADMIN"))
    mockPrisma.user.findUnique.mockResolvedValue({ role: "CHANTRE" })
    expect((await patch("c1", { password: "nouveaumdp123" })).status).toBe(200)
  })

  it("409 (et non 500) si le nouvel email est déjà utilisé", async () => {
    mockAuth.mockResolvedValue(session("u1", "LECTEUR"))
    mockPrisma.user.findUnique.mockResolvedValue({ role: "LECTEUR" })
    mockPrisma.user.findFirst.mockResolvedValue({ id: "autre" })
    expect((await patch("u1", { email: "Pris@Exemple.com" })).status).toBe(409)
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: { equals: "pris@exemple.com", mode: "insensitive" }, NOT: { id: "u1" } } })
    )
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it("409 si la base refuse un doublon (requêtes simultanées)", async () => {
    mockAuth.mockResolvedValue(session("u1", "LECTEUR"))
    mockPrisma.user.findUnique.mockResolvedValue({ role: "LECTEUR" })
    mockPrisma.user.findFirst.mockResolvedValue(null)
    mockPrisma.user.update.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }))
    expect((await patch("u1", { email: "x@exemple.com" })).status).toBe(409)
  })

  it("refuse de rétrograder le dernier administrateur actif", async () => {
    mockAuth.mockResolvedValue(session("a1", "ADMIN"))
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN", isActive: true })
    mockPrisma.user.count.mockResolvedValue(0)
    expect((await patch("a1", { role: "CHANTRE" })).status).toBe(409)
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it("autorise la rétrogradation s'il reste un autre administrateur", async () => {
    mockAuth.mockResolvedValue(session("a1", "ADMIN"))
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN", isActive: true })
    mockPrisma.user.count.mockResolvedValue(1)
    expect((await patch("a2", { role: "CHANTRE" })).status).toBe(200)
  })

  it("refuse de désactiver son propre compte", async () => {
    mockAuth.mockResolvedValue(session("a1", "ADMIN"))
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN", isActive: true })
    expect((await patch("a1", { isActive: false })).status).toBe(400)
  })

  it("désactiver un compte invalide ses sessions", async () => {
    mockAuth.mockResolvedValue(session("a1", "ADMIN"))
    mockPrisma.user.findUnique.mockResolvedValue({ role: "CHANTRE", isActive: true })
    expect((await patch("c1", { isActive: false })).status).toBe(200)
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false, sessionVersion: { increment: 1 } }) })
    )
  })

  it("404 si l'utilisateur n'existe pas", async () => {
    mockAuth.mockResolvedValue(session("a1", "ADMIN"))
    mockPrisma.user.findUnique.mockResolvedValue(null)
    expect((await patch("zz", { firstName: "X" })).status).toBe(404)
  })

  it("400 sur JSON invalide", async () => {
    mockAuth.mockResolvedValue(session("u1", "LECTEUR"))
    const res = await PATCH(new Request("http://x", { method: "PATCH", body: "{oops" }), params("u1"))
    expect(res.status).toBe(400)
  })
})
