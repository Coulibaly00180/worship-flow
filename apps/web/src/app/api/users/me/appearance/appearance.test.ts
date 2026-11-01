import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}))

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { GET, PUT } from "./route"
import { DEFAULT_APPEARANCE } from "@/lib/appearanceCore"

const valid = (updatedAt: number, extra: object = {}) => ({
  appearance: { ...DEFAULT_APPEARANCE, accent: "vert" },
  theme: "dark",
  updatedAt,
  ...extra,
})
const put = (body: unknown) => PUT(new Request("http://x", { method: "PUT", body: typeof body === "string" ? body : JSON.stringify(body) }))

describe("/api/users/me/appearance", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "LECTEUR" } })
    mockPrisma.user.findUnique.mockResolvedValue({ uiPrefs: null })
    mockPrisma.user.update.mockResolvedValue({})
  })

  it("401 sans session (GET et PUT)", async () => {
    mockAuth.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    expect((await put(valid(1))).status).toBe(401)
  })

  it("GET renvoie null quand rien n'est enregistré, et les réglages sinon", async () => {
    expect((await (await GET()).json()).data).toBeNull()
    mockPrisma.user.findUnique.mockResolvedValue({ uiPrefs: JSON.stringify(valid(42)) })
    expect((await (await GET()).json()).data.updatedAt).toBe(42)
  })

  it("GET ignore des données corrompues en base", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ uiPrefs: "{cassé" })
    expect((await (await GET()).json()).data).toBeNull()
  })

  it("PUT enregistre pour le compte connecté uniquement", async () => {
    const res = await put(valid(1000))
    expect(res.status).toBe(200)
    expect(mockPrisma.user.update.mock.calls[0][0].where).toEqual({ id: "u1" })
    expect(JSON.parse(mockPrisma.user.update.mock.calls[0][0].data.uiPrefs).appearance.accent).toBe("vert")
  })

  it("PUT refuse JSON invalide (400) et valeurs hors liste (400)", async () => {
    expect((await put("{pas du json")).status).toBe(400)
    expect((await put(valid(1, { theme: "rose" }))).status).toBe(400)
    expect((await put(valid(1, { appearance: { ...DEFAULT_APPEARANCE, accent: "x" } }))).status).toBe(400)
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it("PUT n'écrase pas une copie plus récente (appareil en retard)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ uiPrefs: JSON.stringify(valid(5000)) })
    const res = await put(valid(1000))
    const json = await res.json()
    expect(json.ignored).toBe(true)
    expect(json.data.updatedAt).toBe(5000)
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it("PUT borne un horodatage dans le futur (horloge déréglée)", async () => {
    const future = Date.now() + 10 * 24 * 3600 * 1000
    await put(valid(future))
    const stored = JSON.parse(mockPrisma.user.update.mock.calls[0][0].data.uiPrefs)
    expect(stored.updatedAt).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000 + 50)
  })
})
