/**
 * Diagrammes d'accords de guitare (accordage standard). Les accords courants à vide sont donnés tels quels ;
 * les autres sont obtenus en déplaçant une forme avec barré (forme de mi ou forme de la).
 * Les cordes sont numérotées de la plus grave (0 = mi grave) à la plus aiguë (5 = mi aigu).
 */

export type ChordShape = {
  /** Case jouée sur chaque corde : -1 = corde non jouée, 0 = corde à vide. */
  frets: number[]
  /** Numéro de la case affichée en haut du diagramme (1 = sillet). */
  baseFret: number
  /** Barré éventuel (cases > 0) : de la corde `from` à la corde `to`. */
  barre?: { fret: number; from: number; to: number }
}

const ROOT: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** Notation d'un accord → qualité normalisée ; undefined si non gérée. */
const QUALITY_ALIASES: Record<string, string> = {
  "": "", maj: "", M: "", m: "m", min: "m", "-": "m",
  "7": "7", m7: "m7", min7: "m7", "-7": "m7",
  maj7: "maj7", M7: "maj7", "Δ": "maj7", "Δ7": "maj7",
  sus4: "sus4", sus: "sus4", sus2: "sus2",
  "6": "6", add9: "add9", "2": "add9",
  dim: "dim", "°": "dim", aug: "aug", "+": "aug",
}

/** Formes mobiles : décalages par rapport à la case de la fondamentale (-1 = muet). */
const E_SHAPE: Record<string, number[]> = {
  "": [0, 2, 2, 1, 0, 0],
  m: [0, 2, 2, 0, 0, 0],
  "7": [0, 2, 0, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
  sus4: [0, 2, 2, 2, 0, 0],
  "6": [0, 2, 2, 1, 2, 0],
}
const A_SHAPE: Record<string, number[]> = {
  "": [-1, 0, 2, 2, 2, 0],
  m: [-1, 0, 2, 2, 1, 0],
  "7": [-1, 0, 2, 0, 2, 0],
  m7: [-1, 0, 2, 0, 1, 0],
  maj7: [-1, 0, 2, 1, 2, 0],
  sus4: [-1, 0, 2, 2, 3, 0],
  sus2: [-1, 0, 2, 2, 0, 0],
  "6": [-1, 0, 2, 2, 2, 2],
  add9: [-1, 0, 2, 4, 2, 0],
  dim: [-1, 0, 1, 2, 1, -1],
  aug: [-1, 0, 3, 2, 2, 1],
}

/** Accords à vide d'usage courant, plus agréables que leur version avec barré. */
const OPEN: Record<string, number[]> = {
  C: [-1, 3, 2, 0, 1, 0], C7: [-1, 3, 2, 3, 1, 0], Cmaj7: [-1, 3, 2, 0, 0, 0], Cadd9: [-1, 3, 2, 0, 3, 0],
  D: [-1, -1, 0, 2, 3, 2], D7: [-1, -1, 0, 2, 1, 2], Dmaj7: [-1, -1, 0, 2, 2, 2], Dm: [-1, -1, 0, 2, 3, 1], Dm7: [-1, -1, 0, 2, 1, 1],
  Dsus2: [-1, -1, 0, 2, 3, 0], Dsus4: [-1, -1, 0, 2, 3, 3],
  G: [3, 2, 0, 0, 0, 3], G7: [3, 2, 0, 0, 0, 1], Gmaj7: [3, 2, 0, 0, 0, 2],
  B7: [-1, 2, 1, 2, 0, 2], Fmaj7: [-1, -1, 3, 2, 1, 0],
}

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

function parse(chord: string): { root: number; quality: string; name: string } | null {
  const main = chord.split("/")[0] // « C/E » : on montre l'accord principal
  const m = /^([A-G])([#b♯♭]?)(.*)$/.exec(main)
  if (!m) return null
  const acc = m[2] === "#" || m[2] === "♯" ? 1 : m[2] === "b" || m[2] === "♭" ? -1 : 0
  const root = (ROOT[m[1]] + acc + 12) % 12
  const quality = QUALITY_ALIASES[m[3]]
  if (quality === undefined) return null
  // nom canonique pour l'accord à vide (Db → C#, etc. : on cherche dans les deux écritures)
  return { root, quality, name: "" }
}

function fromTemplate(template: number[], rootFret: number, rootString: number): ChordShape {
  const frets = template.map((o) => (o < 0 ? -1 : o + rootFret))
  const pressed = frets.filter((f) => f > 0)
  const barre =
    rootFret > 0
      ? { fret: rootFret, from: rootString === 0 ? 0 : 1, to: 5 }
      : undefined
  const max = pressed.length ? Math.max(...pressed) : 0
  const min = pressed.length ? Math.min(...pressed) : 1
  return { frets, baseFret: max <= 4 ? 1 : Math.max(1, min), barre }
}

/** Forme de guitare pour un accord (noms anglais : G7, F#m, Bb/F…) ; null si l'accord n'est pas géré. */
export function guitarChord(chord: string): ChordShape | null {
  const p = parse(chord)
  if (!p) return null

  // 1) accords à vide usuels (cherchés sous leurs deux écritures : C# / Db…)
  for (const names of [SHARP_NAMES, FLAT_NAMES]) {
    const open = OPEN[`${names[p.root]}${p.quality}`]
    if (open) {
      const pressed = open.filter((f) => f > 0)
      return { frets: open, baseFret: Math.max(...pressed) <= 4 ? 1 : Math.min(...pressed) }
    }
  }

  // 2) forme mobile avec barré : la plus basse sur le manche
  const candidates: ChordShape[] = []
  const e = E_SHAPE[p.quality]
  if (e) candidates.push(fromTemplate(e, (p.root - 4 + 12) % 12, 0))
  const a = A_SHAPE[p.quality]
  if (a) candidates.push(fromTemplate(a, (p.root - 9 + 12) % 12, 1))
  if (candidates.length === 0) return null
  const rootFret = (s: ChordShape) => (s.barre ? s.barre.fret : 0)
  candidates.sort((x, y) => rootFret(x) - rootFret(y))
  return candidates[0]
}
