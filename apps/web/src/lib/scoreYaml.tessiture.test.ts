import { describe, it, expect } from "vitest"
import { compileYamlScore } from "./scoreYaml"

const compile = (src: string) => {
  const r = compileYamlScore(src)
  return r
}
const warn = (src: string) => {
  const r = compile(src)
  if (!r.ok) throw new Error(r.errors.join(" / "))
  return r.warnings.join(" | ")
}
const err = (src: string) => {
  const r = compile(src)
  if (r.ok) throw new Error("devrait échouer")
  return r.errors.join(" | ")
}

describe("tessiture selon le nom de la voix (voix collectives et variantes)", () => {
  it.each([
    ["Femmes", "voix de femmes"], ["Dames", "voix de femmes"], ["Hommes", "voix d'hommes"], ["Messieurs", "voix d'hommes"],
    ["Enfants", "voix d'enfants"], ["Baryton", "baryton"], ["Mezzo", "mezzo-soprano"], ["Soprano 2", "soprano"], ["Basses", "basse"], ["Ténors 1", "ténor"],
  ])("« %s » est contrôlée comme %s", (nom, label) => {
    // do''' = trop aigu pour toutes ces voix ; do,,, trop grave pour toutes
    expect(warn(`voix:\n  - nom: ${nom}\n    notes: do'''`)).toContain(label)
    expect(warn(`voix:\n  - nom: ${nom}\n    notes: do,,,`)).toContain(label)
  })

  it("une voix aux notes dans sa tessiture ne donne aucun avertissement", () => {
    expect(warn("voix:\n  - nom: Femmes\n    notes: sol la si do' ré'")).toBe("")
    expect(warn("voix:\n  - nom: Hommes\n    notes: sol la si do' ré'")).toBe("")
    expect(warn("voix:\n  - nom: Baryton\n    notes: do, ré, mi, fa, sol,")).toBe("")
  })

  it("« Femmes » / « Hommes » prennent la clé de lecture adaptée", () => {
    const r = compile("voix:\n  - nom: Femmes\n    notes: do\n  - nom: Hommes\n    notes: do")
    expect(r.ok && r.abc).toContain('name="Femmes" clef=treble')
    expect(r.ok && r.abc).toContain('name="Hommes" clef=treble-8')
  })
})

describe("« tessiture: » choisit le contrôle indépendamment du nom", () => {
  it("une voix au nom libre devient contrôlée comme une basse", () => {
    expect(warn("voix:\n  - nom: Pupitre grave\n    tessiture: basse\n    notes: do'' ré''")).toMatch(/Pupitre grave.*trop aigu.*basse/)
  })

  it("accepte les accents et la casse (« Ténor »)", () => {
    expect(warn("voix:\n  - nom: X\n    tessiture: Ténor\n    notes: do'''")).toContain("ténor")
  })

  it("« libre » désactive le contrôle", () => {
    expect(warn("voix:\n  - nom: Basse\n    tessiture: libre\n    notes: do''' ré'''")).toBe("")
  })

  it("valeur à la racine = défaut des voix, la voix peut la surcharger", () => {
    const w = warn("tessiture: libre\nvoix:\n  - nom: A\n    notes: do'''\n  - nom: B\n    tessiture: basse\n    notes: do'''")
    expect(w).toContain("« B »")
    expect(w).not.toContain("« A »")
  })

  it("avec une tessiture de ténor sur une voix sans nom connu, la clé de ténor est utilisée", () => {
    const r = compile("voix:\n  - nom: Pupitre A\n    tessiture: tenor\n    notes: do\n  - nom: Pupitre B\n    tessiture: basse\n    notes: do")
    expect(r.ok && r.abc).toContain('name="Pupitre A" clef=treble-8')
    expect(r.ok && r.abc).toContain('name="Pupitre B" clef=bass')
  })

  it("valeur inconnue : erreur qui liste les valeurs possibles", () => {
    const e = err("voix:\n  - nom: V\n    tessiture: castrat\n    notes: do")
    expect(e).toMatch(/tessiture « castrat » inconnue.*soprano.*libre/)
  })
})
