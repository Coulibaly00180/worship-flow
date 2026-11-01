import { describe, it, expect } from "vitest"
import { canManageTarget } from "./roles"

describe("canManageTarget", () => {
  it("ADMIN peut agir sur tous les rôles", () => {
    for (const r of ["ADMIN", "RESPONSABLE_CHANTRE", "CHANTRE", "LECTEUR"]) {
      expect(canManageTarget("ADMIN", r)).toBe(true)
    }
  })
  it("un gestionnaire ne peut agir que sur des rôles strictement inférieurs", () => {
    expect(canManageTarget("RESPONSABLE_CHANTRE", "ADMIN")).toBe(false)
    expect(canManageTarget("RESPONSABLE_CHANTRE", "RESPONSABLE_CHANTRE")).toBe(false)
    expect(canManageTarget("RESPONSABLE_CHANTRE", "CHANTRE")).toBe(true)
  })
  it("un rôle vide/inconnu n'a aucun pouvoir", () => {
    expect(canManageTarget("", "LECTEUR")).toBe(false)
  })
})
