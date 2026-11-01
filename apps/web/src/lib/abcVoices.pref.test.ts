import { describe, it, expect } from "vitest"
import { voicePrefKey } from "./abcVoices"

describe("voicePrefKey", () => {
  it.each([
    ["Soprano", "SOPRANO"], ["Soprano 2", "SOPRANO"], ["Dessus", "SOPRANO"], ["Alto", "ALTO"], ["Contralto", "ALTO"],
    ["Ténor", "TENOR"], ["Tenors", "TENOR"], ["Basse", "BASSE"], ["Baryton", "BASSE"], ["Basses", "BASSE"],
  ])("%s → %s", (name, key) => expect(voicePrefKey(name)).toBe(key))

  it("une voix au nom libre n'a pas de préférence associée", () => {
    expect(voicePrefKey("Pupitre A")).toBeNull()
    expect(voicePrefKey("Femmes")).toBeNull()
  })
})
