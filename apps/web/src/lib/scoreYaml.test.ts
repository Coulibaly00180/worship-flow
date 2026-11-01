import { describe, it, expect } from "vitest"
import abcjs from "abcjs"
import { compileYamlScore, noteToAbc, YAML_TEMPLATE, MAX_YAML_CHARS } from "./scoreYaml"

const ok = (src: string) => {
  const r = compileYamlScore(src)
  if (!r.ok) throw new Error(r.errors.join(" / "))
  return r
}
const err = (src: string) => {
  const r = compileYamlScore(src)
  if (r.ok) throw new Error("devrait échouer")
  return r.errors
}

/** L'ABC produit doit être compris par abcjs sans avertissement, avec le bon nombre de voix. */
function parsed(abc: string) {
  const [tune] = abcjs.parseOnly(abc)
  return { warnings: (tune.warnings ?? []) as string[], staves: tune.lines.flatMap((l) => ("staff" in l ? [l.staff?.length ?? 0] : [])) }
}

describe("noteToAbc — solfège et lettres", () => {
  it.each([
    ["do", "C"], ["ré", "D"], ["re", "D"], ["Mi", "E"], ["FA", "F"], ["sol", "G"], ["la", "A"], ["si", "B"],
    ["do'", "c"], ["ré''", "d'"], ["sol,", "G,"], ["la,,", "A,,"],
    ["fa#", "^F"], ["sib", "_B"], ["mi=", "=E"], ["do##", "^^C"], ["rébb", "__D"],
    ["sol2", "G2"], ["la/2", "A/2"], ["si3/2", "B3/2"], ["do'4", "c4"], ["sol2-", "G2-"], ["fa#'/2", "^f/2"],
    ["C", "C"], ["c", "c"], ["D,2", "D,2"], ["b", "b"], ["Bb", "_B"],
  ])("%s → %s", (src, abc) => {
    expect(noteToAbc(src)).toBe(abc)
  })

  it("refuse ce qui n'est pas une note", () => {
    for (const bad of ["fax", "xyz", "sol 2", "do'x", "h", "12", "do2/2/2", "ré#b"]) expect(noteToAbc(bad), bad).toBeNull()
  })
})

describe("compileYamlScore — partition à une voix", () => {
  it("compile le modèle fourni (ABC accepté par abcjs, sans avertissement)", () => {
    const r = ok(YAML_TEMPLATE)
    expect(r.abc).toContain("T:Mon chant")
    expect(r.abc).toContain("K:G")
    expect(r.abc).toContain("Q:1/4=90")
    expect(r.abc).toContain("G A B c | d2 c2 |") // do' = c minuscule en ABC (l'octave se code par la casse)
    const p = parsed(r.abc)
    expect(p.warnings).toEqual([])
  })

  it("convertit notes, durées, silences et barres collées", () => {
    const r = ok("tonalite: Do\nvoix:\n  - nom: V\n    notes: do|ré2 z mi/2 fa#|]\n    paroles: a- b")
    expect(r.abc).toContain("C | D2 z E/2 ^F |]")
    expect(r.abc).toContain("w: a- b")
  })

  it("couplets multiples : une ligne w: par couplet", () => {
    const r = ok("voix:\n  - nom: V\n    notes: do ré mi fa\n    paroles:\n      - un deux trois quatre\n      - cinq six sept huit")
    expect(r.abc.match(/^w:/gm)).toHaveLength(2)
  })

  it("paroles alignées ligne à ligne quand les nombres de lignes correspondent", () => {
    const r = ok("voix:\n  - nom: V\n    notes: |\n      do ré |\n      mi fa |]\n    paroles: |\n      a b\n      c d")
    expect(r.abc).toMatch(/C D \|\nw: a b\nE F \|\]\nw: c d/)
  })

  it("accepte la forme sans liste (notes/paroles à la racine)", () => {
    const r = ok("titre: T\nnotes: do ré mi\nparoles: a b c")
    expect(parsed(r.abc).warnings).toEqual([])
    expect(r.abc).toContain("C D E")
  })

  it("tonalités : majeure, mineure, altérées", () => {
    const k = (t: string) => /K:(\S+)/.exec(ok(`tonalite: ${t}\nnotes: do`).abc)?.[1]
    expect([k("Sol"), k("Rém"), k("La mineur"), k("Fa#"), k("Sib"), k("do majeur"), k("G")]).toEqual(["G", "Dm", "Am", "F#", "Bb", "C", "G"])
  })

  it("clé de basse automatique pour une voix « Basse »", () => {
    expect(ok("voix:\n  - nom: Basse\n    notes: do, ré,").abc).toContain("K:C clef=bass")
  })
})

describe("compileYamlScore — plusieurs voix", () => {
  const src = `
titre: Chœur
tonalite: Sol
voix:
  - nom: Soprano
    notes: sol la si do'
    paroles: a b c d
  - nom: Alto
    notes: si, do ré mi
    paroles: a b c d
  - nom: Ténor
    notes: sol, la, si, do
  - nom: Basse
    notes: sol,, la,, si,, do,
`
  it("produit une portée par voix, avec nom et clé adaptés", () => {
    const r = ok(src)
    expect(r.abc).toContain("%%score 1 2 3 4")
    expect(r.abc).toContain('V:1 name="Soprano" clef=treble')
    expect(r.abc).toContain('V:3 name="Ténor" clef=treble-8')
    expect(r.abc).toContain('V:4 name="Basse" clef=bass')
    const p = parsed(r.abc)
    expect(p.warnings).toEqual([])
    expect(p.staves.length).toBeGreaterThan(0)
    expect(Math.max(...p.staves)).toBe(4)
  })

  it("accepte la forme « dictionnaire » (nom → contenu)", () => {
    const r = ok("voix:\n  Soprano:\n    notes: do ré\n  Alto:\n    notes: mi fa")
    expect(r.abc).toContain('name="Soprano"')
    expect(r.abc).toContain('name="Alto"')
  })

  it("accepte plus de deux voix mais refuse plus de huit", () => {
    const many = Array.from({ length: 9 }, (_, i) => `  - nom: V${i}\n    notes: do`).join("\n")
    expect(err(`voix:\n${many}`).join(" ")).toMatch(/8 voix/)
  })
})

describe("compileYamlScore — erreurs lisibles", () => {
  it("YAML mal formé : indique la ligne", () => {
    expect(err("titre: Mon chant\nvoix:\n  - nom: V\n   notes: do").join(" ")).toMatch(/ligne \d/)
  })

  it("note invalide : nomme la voix et le jeton fautif", () => {
    const e = err("voix:\n  - nom: Alto\n    notes: do fax mi")
    expect(e[0]).toContain("Alto")
    expect(e[0]).toContain("« fax »")
  })

  it("signale toutes les notes fautives, pas seulement la première", () => {
    expect(err("notes: do xx mi yy").length).toBe(2)
  })

  it("tonalité, mesure, tempo et unité invalides", () => {
    expect(err("tonalite: Zorglub\nnotes: do").join(" ")).toMatch(/Tonalité/)
    expect(err("mesure: quatre\nnotes: do").join(" ")).toMatch(/Mesure/)
    expect(err("tempo: 9000\nnotes: do").join(" ")).toMatch(/tempo/i)
    expect(err("unite: noire\nnotes: do").join(" ")).toMatch(/Unité/)
  })

  it("voix sans notes, partition vide, racine non-objet", () => {
    expect(err("voix:\n  - nom: V\n    paroles: a b").join(" ")).toMatch(/notes/)
    expect(err("   ").join(" ")).toMatch(/vide/)
    expect(err("- a\n- b").join(" ")).toMatch(/clé: valeur/)
    expect(err("voix: []").join(" ")).toMatch(/notes/)
  })

  it("clé de voix inconnue → erreur ; clé de racine inconnue → avertissement seulement", () => {
    expect(err("voix:\n  - nom: V\n    notes: do\n    cle: zzz").join(" ")).toMatch(/clé/)
    const r = ok("titr: faute\nnotes: do")
    expect(r.warnings.join(" ")).toContain("titr")
  })

  it("refuse une source trop longue", () => {
    expect(err("notes: " + "do ".repeat(MAX_YAML_CHARS)).join(" ")).toMatch(/trop longue/)
  })
})

describe("compileYamlScore — sécurité", () => {
  it("ne laisse pas injecter de champs ABC par le titre, le compositeur ou les paroles", () => {
    const r = ok('titre: "Mon\\nK:Z\\nT:pirate"\ncompositeur: "x\\nX:9"\nnotes: do\nparoles: "a b\\nK:Z"')
    const lines = r.abc.split("\n")
    expect(lines.filter((l) => l.startsWith("K:"))).toHaveLength(1)
    expect(lines.filter((l) => l.startsWith("X:"))).toHaveLength(1)
    expect(lines.filter((l) => l.startsWith("T:"))).toHaveLength(1)
  })

  it("neutralise « % » (commentaire ABC) dans les textes", () => {
    const r = ok("titre: 100% foi\nnotes: do\nparoles: a 50% b")
    expect(r.abc).not.toMatch(/%[^%]/)
  })

  it("refuse les alias YAML en cascade (attaque « billion laughs »)", () => {
    const bomb = ["a: &a [x,x,x,x,x,x,x,x,x]", ...Array.from({ length: 12 }, (_, i) => `b${i}: &b${i} [*${i === 0 ? "a" : `b${i - 1}`}, *${i === 0 ? "a" : `b${i - 1}`}]`), "notes: do"].join("\n")
    expect(() => compileYamlScore(bomb)).not.toThrow()
  })
})
