import { describe, it, expect, beforeEach } from "vitest"
import {
  lockRemaining,
  recordFailure,
  recordSuccess,
  resetRateLimit,
  MAX_FAILURES,
  LOCK_MS,
  WINDOW_MS,
} from "./rateLimit"

describe("rateLimit", () => {
  beforeEach(() => resetRateLimit())

  it("autorise tant que le seuil n'est pas atteint", () => {
    for (let i = 0; i < MAX_FAILURES - 1; i++) recordFailure("a", 1000)
    expect(lockRemaining("a", 1000)).toBe(0)
  })

  it("bloque après MAX_FAILURES échecs, puis débloque", () => {
    for (let i = 0; i < MAX_FAILURES; i++) recordFailure("a", 1000)
    expect(lockRemaining("a", 1000)).toBe(LOCK_MS)
    expect(lockRemaining("a", 1000 + LOCK_MS)).toBe(0)
  })

  it("ignore les échecs sortis de la fenêtre", () => {
    for (let i = 0; i < MAX_FAILURES - 1; i++) recordFailure("a", 0)
    recordFailure("a", WINDOW_MS + 1)
    expect(lockRemaining("a", WINDOW_MS + 1)).toBe(0)
  })

  it("un succès remet le compteur à zéro", () => {
    for (let i = 0; i < MAX_FAILURES - 1; i++) recordFailure("a", 1000)
    recordSuccess("a")
    recordFailure("a", 1000)
    expect(lockRemaining("a", 1000)).toBe(0)
  })

  it("les clés sont indépendantes", () => {
    for (let i = 0; i < MAX_FAILURES; i++) recordFailure("a", 1000)
    expect(lockRemaining("b", 1000)).toBe(0)
  })
})
