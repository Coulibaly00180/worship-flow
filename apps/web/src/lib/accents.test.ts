import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import data from "./accents.json"
import { buildAccentsCss } from "../../scripts/gen-accents.mjs"

/** Luminance relative WCAG d'une couleur #rrggbb. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Surfaces de globals.css sur lesquelles l'accent sert de texte ou de fond
const LIGHT = { bg: "#fbf8f2", surface: "#ffffff" }
const DARK = { bg: "#17120e", surface: "#251e17" }

describe.each(Object.entries(data.accents))("accent « %s » — contrastes WCAG AA (≥ 4,5:1)", (_id, a) => {
  it("clair : texte du bouton, accent en texte, conteneur", () => {
    expect(contrast(a.light["on-primary"], a.light.primary), "bouton").toBeGreaterThanOrEqual(4.5)
    expect(contrast(a.light["on-primary"], a.light["primary-dim"]), "bouton au survol").toBeGreaterThanOrEqual(4.5)
    expect(contrast(a.light.primary, LIGHT.bg), "texte sur fond").toBeGreaterThanOrEqual(4.5)
    expect(contrast(a.light.primary, LIGHT.surface), "texte sur carte").toBeGreaterThanOrEqual(4.5)
    expect(contrast(a.light["on-primary-container"], a.light["primary-container"]), "conteneur").toBeGreaterThanOrEqual(4.5)
  })

  it("sombre : texte du bouton, accent en texte, conteneur", () => {
    expect(contrast(a.dark["on-primary"], a.dark.primary), "bouton").toBeGreaterThanOrEqual(4.5)
    expect(contrast(a.dark["on-primary"], a.dark["primary-dim"]), "bouton au survol").toBeGreaterThanOrEqual(4.5)
    expect(contrast(a.dark.primary, DARK.bg), "texte sur fond").toBeGreaterThanOrEqual(4.5)
    expect(contrast(a.dark.primary, DARK.surface), "texte sur carte").toBeGreaterThanOrEqual(4.5)
    expect(contrast(a.dark["on-primary-container"], a.dark["primary-container"]), "conteneur").toBeGreaterThanOrEqual(4.5)
  })
})

describe("accents.css", () => {
  it("est à jour par rapport à accents.json (relancer node scripts/gen-accents.mjs sinon)", () => {
    const committed = readFileSync(join(__dirname, "../app/accents.css"), "utf8").replace(/\r\n/g, "\n")
    expect(committed).toBe(buildAccentsCss(data).replace(/\r\n/g, "\n"))
  })

  it("l'accent par défaut existe et n'est pas émis (il vit dans globals.css)", () => {
    expect(Object.keys(data.accents)).toContain(data.default)
    expect(buildAccentsCss(data)).not.toContain(`data-accent="${data.default}"`)
  })
})
