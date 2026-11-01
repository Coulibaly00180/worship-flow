import { describe, it, expect } from "vitest"
import { searchTerms, likePattern, sortByRank } from "./songSearch"
import { parsePrefs, DEFAULT_PREFS } from "./readPrefs"

describe("searchTerms", () => {
  it("découpe sur les espaces et ignore les vides", () => {
    expect(searchTerms("  grâce   infinie ")).toEqual(["grâce", "infinie"])
    expect(searchTerms("   ")).toEqual([])
  })
  it("limite le nombre de mots", () => {
    expect(searchTerms("a b c d e f g h")).toHaveLength(6)
  })
})

describe("likePattern", () => {
  it("échappe les jokers saisis par l'utilisateur", () => {
    expect(likePattern("100%")).toBe("%100\\%%")
    expect(likePattern("a_b")).toBe("%a\\_b%")
    expect(likePattern("a\\b")).toBe("%a\\\\b%")
  })
})

describe("sortByRank", () => {
  it("réordonne selon la pertinence", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }]
    expect(sortByRank(items, ["c", "a", "b"]).map((i) => i.id)).toEqual(["c", "a", "b"])
  })
  it("laisse l'ordre inchangé sans rang", () => {
    const items = [{ id: "b" }, { id: "a" }]
    expect(sortByRank(items, null)).toBe(items)
  })
})

describe("parsePrefs (préférences du mode lecture)", () => {
  it("borne les valeurs aberrantes", () => {
    const p = parsePrefs(JSON.stringify({ fontSize: 9999, speed: -4, theme: "light", view: "scroll", voice: "ALTO" }))
    expect(p).toEqual({ fontSize: 56, speed: 5, theme: "light", view: "scroll", voice: "ALTO" })
  })
  it("retombe sur les valeurs par défaut si le stockage est corrompu", () => {
    expect(parsePrefs("{pas du json")).toEqual(DEFAULT_PREFS)
    expect(parsePrefs(JSON.stringify({ theme: "rose", view: 3, fontSize: "gros" }))).toEqual(DEFAULT_PREFS)
  })
})
