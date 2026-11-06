import { describe, it, expect, beforeEach } from "vitest"
import {
  createMemoryStore,
  lockRemaining,
  recordFailure,
  recordSuccess,
  setRateLimitStore,
  MAX_FAILURES,
  LOCK_MS,
  WINDOW_MS,
} from "./rateLimit"

async function fail(key: string, times: number, at: number, max = MAX_FAILURES) {
  for (let i = 0; i < times; i++) await recordFailure(key, at, max)
}

describe("rateLimit (magasin mémoire)", () => {
  beforeEach(() => setRateLimitStore(createMemoryStore()))

  it("autorise tant que le seuil n'est pas atteint", async () => {
    await fail("a", MAX_FAILURES - 1, 1000)
    expect(await lockRemaining("a", 1000)).toBe(0)
  })

  it("bloque après MAX_FAILURES échecs, puis débloque", async () => {
    await fail("a", MAX_FAILURES, 1000)
    expect(await lockRemaining("a", 1000)).toBe(LOCK_MS)
    expect(await lockRemaining("a", 1000 + LOCK_MS)).toBe(0)
  })

  it("ignore les échecs sortis de la fenêtre", async () => {
    await fail("a", MAX_FAILURES - 1, 0)
    await recordFailure("a", WINDOW_MS + 1)
    expect(await lockRemaining("a", WINDOW_MS + 1)).toBe(0)
  })

  it("un succès remet le compteur à zéro", async () => {
    await fail("a", MAX_FAILURES - 1, 1000)
    await recordSuccess("a")
    await recordFailure("a", 1000)
    expect(await lockRemaining("a", 1000)).toBe(0)
  })

  it("les clés sont indépendantes", async () => {
    await fail("a", MAX_FAILURES, 1000)
    expect(await lockRemaining("b", 1000)).toBe(0)
  })

  it("respecte un seuil personnalisé", async () => {
    await fail("ip:1", 29, 1000, 30)
    expect(await lockRemaining("ip:1", 1000)).toBe(0)
    await recordFailure("ip:1", 1000, 30)
    expect(await lockRemaining("ip:1", 1000)).toBe(LOCK_MS)
  })
})
