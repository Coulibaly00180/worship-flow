import { describe, it, expect } from "vitest"
import { guitarChord } from "./guitarChords"
import { filterAbcVoices, listAbcVoices, matchVoiceId } from "./abcVoices"
import abcjs from "abcjs"
import { compileYamlScore, YAML_EXAMPLE_FULL } from "./scoreYaml"

const frets = (c: string) => guitarChord(c)?.frets

describe("guitarChord — accords à vide usuels", () => {
  it.each([
    ["C", [-1, 3, 2, 0, 1, 0]], ["G", [3, 2, 0, 0, 0, 3]], ["D", [-1, -1, 0, 2, 3, 2]], ["Dm", [-1, -1, 0, 2, 3, 1]],
    ["Em", [0, 2, 2, 0, 0, 0]], ["Am", [-1, 0, 2, 2, 1, 0]], ["E", [0, 2, 2, 1, 0, 0]], ["A", [-1, 0, 2, 2, 2, 0]],
    ["G7", [3, 2, 0, 0, 0, 1]], ["E7", [0, 2, 0, 1, 0, 0]], ["A7", [-1, 0, 2, 0, 2, 0]], ["B7", [-1, 2, 1, 2, 0, 2]],
    ["Cmaj7", [-1, 3, 2, 0, 0, 0]], ["Asus2", [-1, 0, 2, 2, 0, 0]], ["Dsus4", [-1, -1, 0, 2, 3, 3]],
  ])("%s", (chord, expected) => {
    expect(frets(chord)).toEqual(expected)
  })
})

describe("guitarChord — formes mobiles (barré)", () => {
  it("F = forme de mi à la case 1, avec barré", () => {
    const f = guitarChord("F")!
    expect(f.frets).toEqual([1, 3, 3, 2, 1, 1])
    expect(f.barre).toEqual({ fret: 1, from: 0, to: 5 })
  })
  it("Bm, Bb, F#m, C#m7 : barré le plus bas sur le manche", () => {
    expect(frets("Bm")).toEqual([-1, 2, 4, 4, 3, 2])
    expect(frets("Bb")).toEqual([-1, 1, 3, 3, 3, 1])
    expect(frets("F#m")).toEqual([2, 4, 4, 2, 2, 2])
    expect(frets("C#m7")).toEqual([-1, 4, 6, 4, 5, 4])
    expect(guitarChord("C#m7")!.baseFret).toBe(4)
  })
  it("les deux écritures d'une même note donnent la même forme (C# = Db, Eb = D#)", () => {
    expect(frets("Db")).toEqual(frets("C#"))
    expect(frets("Ebm")).toEqual(frets("D#m"))
  })
  it("accord avec basse : montre l'accord principal", () => {
    expect(frets("C/E")).toEqual(frets("C"))
    expect(frets("Bb/F")).toEqual(frets("Bb"))
  })
  it("variantes d'écriture de la qualité", () => {
    expect(frets("Amin")).toEqual(frets("Am"))
    expect(frets("CM7")).toEqual(frets("Cmaj7"))
    expect(frets("Dsus")).toEqual(frets("Dsus4"))
  })
  it("renvoie null pour un accord non géré plutôt qu'un faux diagramme", () => {
    for (const bad of ["Gm7b5", "C9", "H", "", "C13", "Xm"]) expect(guitarChord(bad), bad).toBeNull()
  })
  it("toutes les formes tiennent sur 6 cordes, cases 0 à 15, au moins 3 cordes jouées", () => {
    const roots = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
    const quals = ["", "m", "7", "m7", "maj7", "sus4", "sus2", "6", "add9", "dim", "aug"]
    for (const r of roots) {
      for (const q of quals) {
        const s = guitarChord(r + q)
        if (!s) continue
        expect(s.frets).toHaveLength(6)
        expect(Math.max(...s.frets)).toBeLessThanOrEqual(15)
        expect(s.frets.filter((f) => f >= 0).length, r + q).toBeGreaterThanOrEqual(3)
      }
    }
  })
})

describe("abcVoices — afficher/écouter seulement certaines voix", () => {
  const abc = (() => {
    const r = compileYamlScore(YAML_EXAMPLE_FULL)
    if (!r.ok) throw new Error(r.errors.join())
    return r.abc
  })()
  const parsed = (a: string) => {
    const [tune] = abcjs.parseOnly(a)
    return { warnings: (tune.warnings ?? []) as string[], staves: Math.max(0, ...tune.lines.map((l) => ("staff" in l ? (l.staff?.length ?? 0) : 0))) }
  }

  it("liste les voix déclarées (nom d'après name=\"…\")", () => {
    expect(listAbcVoices(abc).map((v) => v.name)).toEqual(["Soprano", "Alto", "Ténor", "Basse"])
  })

  it("une partition à une voix ou un ABC sans voix déclarées n'est pas filtrable", () => {
    expect(listAbcVoices("X:1\nK:C\nCDEF|")).toEqual([])
    const single = compileYamlScore("notes: do ré")
    expect(single.ok && listAbcVoices(single.abc)).toEqual([])
    expect(filterAbcVoices("X:1\nK:C\nCDEF|", ["1"])).toBe("X:1\nK:C\nCDEF|")
  })

  it("garder une voix : une seule portée, les autres voix disparaissent", () => {
    const only = filterAbcVoices(abc, ["1"])
    expect(only).toContain('name="Soprano"')
    expect(only).not.toContain('name="Alto"')
    expect(only).not.toContain("%%score")
    const p = parsed(only)
    expect(p.warnings).toEqual([])
    expect(p.staves).toBe(1)
  })

  it("garder deux voix : %%score réécrit, deux portées", () => {
    const two = filterAbcVoices(abc, ["1", "4"])
    expect(two).toContain("%%score 1 4")
    expect(parsed(two).staves).toBe(2)
    expect(parsed(two).warnings).toEqual([])
  })

  it("garder toutes les voix, ou aucune voix valable : ABC inchangé", () => {
    expect(filterAbcVoices(abc, ["1", "2", "3", "4"])).toBe(abc)
    expect(filterAbcVoices(abc, [])).toBe(abc)
    expect(filterAbcVoices(abc, ["99"])).toBe(abc)
  })

  it("le filtrage réduit la hauteur : moins de lignes de musique", () => {
    expect(filterAbcVoices(abc, ["1"]).split("\n").length).toBeLessThan(abc.split("\n").length)
  })

  it("matchVoiceId retrouve la voix préférée par son nom", () => {
    const v = listAbcVoices(abc)
    expect(matchVoiceId(v, "SOPRANO")).toBe("1")
    expect(matchVoiceId(v, "TENOR")).toBe("3")
    expect(matchVoiceId(v, "BASSE")).toBe("4")
    expect(matchVoiceId(v, "ALL")).toBeNull()
  })
})
