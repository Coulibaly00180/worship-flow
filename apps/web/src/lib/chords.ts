/**
 * Accords : on les saisit en français (Sol7, Rém, Sib/Fa) ou en anglais (G7, Dm, Bb/F).
 * abcjs ne transpose que les noms anglais : on les stocke donc en anglais dans l'ABC et on les
 * réaffiche en français après le rendu (voir AbcScore).
 */

const FR_TO_EN: Record<string, string> = { do: "C", re: "D", mi: "E", fa: "F", sol: "G", la: "A", si: "B" }
const EN_TO_FR: Record<string, string> = { C: "Do", D: "Ré", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Si" }

const ROOT_RE = /^(do|re|ré|mi|fa|sol|la|si|[A-Ga-g])([#b♯♭]?)(.*)$/i
const QUALITY_RE = /^[A-Za-z0-9#♯♭+°ø()-]{0,12}$/

const strip = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "")

// « Fadd9 » (Fa + add9 en anglais) ressemble à « Fa » + « dd9 » en solfège : on le traite comme un accord anglais
const ENGLISH_ADD_RE = /^([A-Ga-g])([#b♯♭]?)(add\d.*)$/

function parseRoot(s: string): { letter: string; acc: string; rest: string } | null {
  const en = ENGLISH_ADD_RE.exec(s)
  const m = en ?? ROOT_RE.exec(s)
  if (!m) return null
  const name = strip(m[1]).toLowerCase()
  const letter = FR_TO_EN[name] ?? name.toUpperCase()
  const acc = m[2] === "♯" ? "#" : m[2] === "♭" ? "b" : m[2]
  return { letter, acc, rest: m[3] }
}

/** « Sol7 », « Rém », « Sib/Fa », « G » → nom anglais (« G7 », « Dm », « Bb/F », « G ») ; null si ce n'est pas un accord. */
export function chordToEnglish(token: string): string | null {
  const [main, bass, ...extra] = token.split("/")
  if (extra.length > 0 || main === undefined) return null
  const root = parseRoot(main)
  if (!root) return null
  // « min » s'écrit « m » en notation d'accords
  const quality = root.rest.replace(/^min(?!or)/i, "m")
  if (!QUALITY_RE.test(quality)) return null
  let out = `${root.letter}${root.acc}${quality}`
  if (bass !== undefined) {
    const b = parseRoot(bass)
    if (!b || b.rest !== "") return null
    out += `/${b.letter}${b.acc}`
  }
  return out
}

const EN_CHORD_RE = /^([A-G])([#b♯♭]?)([^/]*)(?:\/([A-G])([#b♯♭]?))?$/

/** « G7 » → « Sol7 », « Bb/F » → « Sib/Fa » ; tout ce qui n'est pas un accord anglais est laissé tel quel. */
export function chordToFrench(chord: string): string {
  const m = EN_CHORD_RE.exec(chord.trim())
  if (!m) return chord
  const [, root, acc, quality, bass, bassAcc] = m
  return `${EN_TO_FR[root]}${acc}${quality}${bass ? `/${EN_TO_FR[bass]}${bassAcc ?? ""}` : ""}`
}
