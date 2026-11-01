import { describe, it, expect } from "vitest"
import { SyncPayloadSchema, decideSync, parseStoredPrefs } from "./appearanceSync"
import { DEFAULT_APPEARANCE } from "./appearanceCore"

const payload = (updatedAt: number) => ({ appearance: DEFAULT_APPEARANCE, theme: "system" as const, updatedAt })

describe("decideSync — la modification la plus récente gagne", () => {
  it("rien à faire si ni l'appareil ni le serveur n'ont de réglages", () => {
    expect(decideSync(null, null)).toBe("none")
    expect(decideSync({ updatedAt: 0 }, null)).toBe("none")
  })
  it("envoie les réglages locaux quand le serveur n'en a pas", () => {
    expect(decideSync({ updatedAt: 1000 }, null)).toBe("push")
  })
  it("récupère ceux du serveur sur un appareil jamais personnalisé", () => {
    expect(decideSync(null, { updatedAt: 1000 })).toBe("pull")
    expect(decideSync({ updatedAt: 0 }, { updatedAt: 1000 })).toBe("pull")
  })
  it("compare les horodatages", () => {
    expect(decideSync({ updatedAt: 1000 }, { updatedAt: 2000 })).toBe("pull")
    expect(decideSync({ updatedAt: 3000 }, { updatedAt: 2000 })).toBe("push")
    expect(decideSync({ updatedAt: 2000 }, { updatedAt: 2000 })).toBe("none")
  })
  it("des réglages d'avant la synchronisation (horodatage 1) cèdent devant ceux du serveur", () => {
    expect(decideSync({ updatedAt: 1 }, { updatedAt: 1700000000000 })).toBe("pull")
  })
})

describe("SyncPayloadSchema", () => {
  it("accepte des réglages valides", () => {
    expect(SyncPayloadSchema.safeParse(payload(5)).success).toBe(true)
  })
  it("refuse toute valeur hors liste (rien d'inattendu n'est stocké puis réinjecté dans <html>)", () => {
    const bad = (patch: object) => SyncPayloadSchema.safeParse({ ...payload(5), ...patch }).success
    expect(bad({ theme: "rose" })).toBe(false)
    expect(bad({ updatedAt: -1 })).toBe(false)
    expect(bad({ updatedAt: "hier" })).toBe(false)
    expect(bad({ appearance: { ...DEFAULT_APPEARANCE, accent: '"><script>' } })).toBe(false)
    expect(bad({ appearance: { ...DEFAULT_APPEARANCE, textSize: "énorme" } })).toBe(false)
  })
})

describe("parseStoredPrefs", () => {
  it("relit ce qui a été stocké", () => {
    expect(parseStoredPrefs(JSON.stringify(payload(7)))?.updatedAt).toBe(7)
  })
  it("renvoie null pour une valeur absente, corrompue ou invalide", () => {
    expect(parseStoredPrefs(null)).toBeNull()
    expect(parseStoredPrefs("{cassé")).toBeNull()
    expect(parseStoredPrefs(JSON.stringify({ theme: "x" }))).toBeNull()
  })
})
