import { describe, it, expect } from "vitest"
import abcjs from "abcjs"
import { compileYamlScore, noteToAbc, YAML_EXAMPLE_FULL } from "./scoreYaml"
import { chordToEnglish, chordToFrench } from "./chords"

const ok = (src: string) => {
  const r = compileYamlScore(src)
  if (!r.ok) throw new Error(r.errors.join(" / "))
  return r
}
const err = (src: string) => {
  const r = compileYamlScore(src)
  if (r.ok) throw new Error("devrait échouer")
  return r.errors.join(" | ")
}
const warnings = (abc: string) => ((abcjs.parseOnly(abc)[0].warnings ?? []) as string[])

describe("décalage d'octave", () => {
  it("noteToAbc applique le décalage", () => {
    expect(noteToAbc("do", 1)).toBe("c")
    expect(noteToAbc("do", -1)).toBe("C,")
    expect(noteToAbc("sol'", -1)).toBe("G")
  })

  it("« octave: » par voix décale toutes ses notes ; « octave: » racine = valeur par défaut", () => {
    const r = ok("voix:\n  - nom: V\n    octave: -1\n    notes: do ré'")
    expect(r.abc).toContain("C, D")
    const g = ok("octave: 1\nvoix:\n  - nom: A\n    notes: do\n  - nom: B\n    octave: 0\n    notes: do")
    const bodies = g.abc.split("\n").filter((l) => /^[cC]/.test(l))
    expect(bodies).toEqual(["c", "C"])
  })

  it("refuse un décalage invalide", () => {
    expect(err("voix:\n  - nom: V\n    octave: 9\n    notes: do")).toMatch(/octave/)
    expect(err("octave: beaucoup\nnotes: do")).toMatch(/octave/)
  })
})

describe("avertissements de tessiture (jamais bloquants)", () => {
  it("signale une basse trop aiguë et propose le décalage", () => {
    const r = ok("voix:\n  - nom: Basse\n    notes: do'' ré''")
    expect(r.warnings.join(" ")).toMatch(/Basse.*trop aigu.*basse.*octave: -1/)
  })

  it("signale un soprano trop grave", () => {
    expect(ok("voix:\n  - nom: Soprano\n    notes: do,, ré,,").warnings.join(" ")).toMatch(/Soprano.*trop grave/)
  })

  it("ne dit rien pour une tessiture normale, et le décalage corrige l'alerte", () => {
    expect(ok("voix:\n  - nom: Soprano\n    notes: do ré mi sol la do'").warnings).toEqual([])
    const high = ok("voix:\n  - nom: Basse\n    octave: -2\n    notes: do'' ré''")
    expect(high.warnings).toEqual([])
  })

  it("une voix sans nom connu n'est contrôlée que sur la tessiture humaine", () => {
    expect(ok("notes: do'''").warnings.join(" ")).toMatch(/trop aigu.*voix humaine/)
    expect(ok("notes: do ré'' ").warnings).toEqual([])
  })
})

describe("accords", () => {
  it.each([
    ["Sol", "G"], ["Sol7", "G7"], ["Rém", "Dm"], ["La mineur".replace(" mineur", "m"), "Am"], ["Sib", "Bb"], ["Fa#m7", "F#m7"],
    ["Do/Mi", "C/E"], ["Sib/Fa", "Bb/F"], ["Mimin", "Em"], ["Dosus4", "Csus4"], ["Fadd9", "Fadd9"], ["G7", "G7"], ["Bb/F", "Bb/F"], ["Réaug", "Daug"],
  ])("%s → %s", (src, en) => {
    expect(chordToEnglish(src)).toBe(en)
  })

  it("refuse ce qui n'est pas un accord", () => {
    for (const bad of ["Xyz", "Sol/", "Sol/Mi/Fa", "Sol7777777777777", "", "123"]) expect(chordToEnglish(bad), bad).toBeNull()
  })

  it("chordToFrench est l'inverse pour l'affichage", () => {
    expect(chordToFrench("G7")).toBe("Sol7")
    expect(chordToFrench("F#m7")).toBe("Fa#m7")
    expect(chordToFrench("Bb/F")).toBe("Sib/Fa")
    expect(chordToFrench("Cmaj7")).toBe("Domaj7")
    expect(chordToFrench("Introduction")).toBe("Introduction") // pas un accord : inchangé
  })

  it("« @Sol » se place devant la note suivante, en nom anglais (donc transposable)", () => {
    const r = ok("notes: '@Sol sol la @Rém7 z2 | @Do do'")
    expect(r.abc).toContain('"G"G A "Dm7"z2 | "C"C')
    expect(abcjs.parseOnly(r.abc)[0].warnings ?? []).toEqual([])
  })

  it("accord sans note derrière, ou invalide → erreur claire", () => {
    expect(err("notes: do @Sol")).toMatch(/« @Sol » doit être suivi d'une note/)
    expect(err("notes: do @Zorg ré")).toMatch(/« @Zorg » n'est pas un accord/)
  })
})

describe("nuances, ornements, reprises et textes", () => {
  it("nuances et crescendo", () => {
    const r = ok("notes: '!mf do ré !cresc( mi fa !cresc) !f sol'")
    expect(r.abc).toContain("!mf!C D !crescendo(!E F !crescendo)!!f!G")
    expect(warnings(r.abc)).toEqual([])
  })

  it("signes de reprise et fermata", () => {
    const r = ok("notes: '!segno do ré | !fine mi | !dc fa !fermata sol |]'")
    expect(r.abc).toContain("!segno!C D | !fine!E | !D.C.!F !fermata!G |]")
    expect(warnings(r.abc)).toEqual([])
  })

  it("texte au-dessus de la portée : « ^Refrain_x2 »", () => {
    const r = ok("notes: '^Refrain_x2 do ré'")
    expect(r.abc).toContain('"^Refrain x2"C D')
    expect(warnings(r.abc)).toEqual([])
  })

  it("nuance inconnue : l'erreur liste les nuances disponibles", () => {
    expect(err("notes: do !forte ré")).toMatch(/« !forte » est inconnu.*!mf/)
  })

  it("reprises avec voltas 1 et 2", () => {
    const r = ok("notes: '|: do ré |1 mi :|2 fa |]'")
    expect(r.abc).toContain("|: C D |1 E :|2 F |]")
    expect(warnings(r.abc)).toEqual([])
  })
})

describe("exemple complet et partitions denses", () => {
  it("l'exemple complet compile (4 voix, accords, nuances, volta) sans avertissement abcjs ni de tessiture", () => {
    const r = ok(YAML_EXAMPLE_FULL)
    expect(r.warnings).toEqual([])
    expect(warnings(r.abc)).toEqual([])
    expect(r.abc).toContain("%%score 1 2 3 4")
  })

  it("4 voix × 24 mesures avec paroles et accords : compile vite et abcjs l'accepte", () => {
    const measure = "sol la si do'"
    const line = Array.from({ length: 8 }, () => measure).join(" | ")
    const voice = (nom: string, extra = "") =>
      `  - nom: ${nom}\n${extra}    notes: |\n      @Sol ${line} |\n      ${line} |\n      ${line} |]\n    paroles: |\n      ${Array.from({ length: 8 }, () => "a- b- c- d-").join(" ")}\n      ${Array.from({ length: 8 }, () => "e- f- g- h-").join(" ")}\n      ${Array.from({ length: 8 }, () => "i- j- k- l-").join(" ")}`
    const src = `titre: Dense\ntonalite: Sol\nvoix:\n${voice("Soprano")}\n${voice("Alto", "    octave: -1\n")}\n${voice("Ténor", "    octave: -1\n")}\n${voice("Basse", "    octave: -2\n")}`
    const t0 = performance.now()
    const r = ok(src)
    expect(performance.now() - t0).toBeLessThan(500)
    expect(warnings(r.abc)).toEqual([])
    const [tune] = abcjs.parseOnly(r.abc)
    const bars = r.abc.split("\n").filter((l) => l.includes("|")).join("").split("|").length
    expect(bars).toBeGreaterThan(80)
    expect(tune.lines.length).toBeGreaterThan(0)
  })
})
