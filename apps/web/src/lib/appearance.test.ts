// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest"
import { DEFAULT_APPEARANCE, appearanceAttributes, parseAppearance, ACCENT_IDS } from "./appearanceCore"
import { THEME_INIT_SCRIPT } from "./themeScript"

describe("parseAppearance", () => {
  it("retourne les valeurs par défaut sans stockage ou avec du JSON corrompu", () => {
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE)
    expect(parseAppearance("")).toEqual(DEFAULT_APPEARANCE)
    expect(parseAppearance("{pas du json")).toEqual(DEFAULT_APPEARANCE)
  })

  it("accepte des réglages valides", () => {
    const raw = JSON.stringify({ accent: "vert", textSize: "xlarge", lyricsFont: "serif", motion: "reduce" })
    expect(parseAppearance(raw)).toEqual({ accent: "vert", textSize: "xlarge", lyricsFont: "serif", motion: "reduce" })
  })

  it("remplace toute valeur inconnue ou altérée par le défaut (pas d'injection dans les attributs)", () => {
    const raw = JSON.stringify({ accent: '"><script>', textSize: "gigantesque", lyricsFont: 3, motion: null })
    expect(parseAppearance(raw)).toEqual(DEFAULT_APPEARANCE)
  })
})

describe("appearanceAttributes", () => {
  it("n'ajoute aucun attribut pour les valeurs par défaut", () => {
    expect(Object.values(appearanceAttributes(DEFAULT_APPEARANCE)).every((v) => v === null)).toBe(true)
  })
  it("expose accent, taille, police et mouvement choisis", () => {
    expect(appearanceAttributes({ accent: "bleu", textSize: "large", lyricsFont: "serif", motion: "reduce" })).toEqual({
      "data-accent": "bleu",
      "data-text": "large",
      "data-lyrics": "serif",
      "data-motion": "reduce",
    })
  })
})

describe("script d'initialisation (avant affichage)", () => {
  const root = () => document.documentElement
  const run = () => new Function(THEME_INIT_SCRIPT)()

  beforeEach(() => {
    localStorage.clear()
    for (const a of ["data-theme", "data-accent", "data-text", "data-lyrics", "data-motion"]) root().removeAttribute(a)
  })

  it("ne fait rien sans réglage", () => {
    run()
    expect(root().getAttributeNames().filter((n) => n.startsWith("data-"))).toEqual([])
  })

  it("applique thème et personnalisation enregistrés", () => {
    localStorage.setItem("cp-theme", "dark")
    localStorage.setItem("cp-ui", JSON.stringify({ accent: ACCENT_IDS[1], textSize: "large", lyricsFont: "serif", motion: "reduce" }))
    run()
    expect(root().getAttribute("data-theme")).toBe("dark")
    expect(root().getAttribute("data-accent")).toBe(ACCENT_IDS[1])
    expect(root().getAttribute("data-text")).toBe("large")
    expect(root().getAttribute("data-lyrics")).toBe("serif")
    expect(root().getAttribute("data-motion")).toBe("reduce")
  })

  it("ignore les valeurs invalides et ne plante pas sur un JSON cassé", () => {
    localStorage.setItem("cp-theme", "rose")
    localStorage.setItem("cp-ui", JSON.stringify({ accent: "x", textSize: "y" }))
    expect(() => run()).not.toThrow()
    expect(root().getAttribute("data-theme")).toBeNull()
    expect(root().getAttribute("data-accent")).toBeNull()
    localStorage.setItem("cp-ui", "{cassé")
    expect(() => run()).not.toThrow()
  })
})
