import { parseDocument } from "yaml"

/**
 * Format de partition « YAML en solfège » : plus simple à saisir que l'ABC, compilé en ABC pour
 * l'affichage (abcjs), la transposition et le hors-ligne. Fonction pure : utilisée côté navigateur
 * (aperçu en direct) et côté serveur (compilation faisant foi à l'enregistrement).
 */

export const MAX_YAML_CHARS = 50_000

export type CompileResult =
  | { ok: true; abc: string; warnings: string[] }
  | { ok: false; errors: string[] }

export const YAML_TEMPLATE = `# Partition en solfège — chaque ligne « clé: valeur ».
# do = do du milieu du clavier · do' = octave au-dessus · do, = octave en dessous
# Durées : sol2 (2 temps) · sol/2 (demi-temps) · sol3/2 · z = silence · sol2- (liaison)
# Altérations : fa# (dièse) · sib (bémol) · fa= (bécarre). Barres : | || |] |: :|
titre: Mon chant
compositeur: Auteur
tonalite: Sol        # Do, Ré, Mi, Fa, Sol, La, Si — ajoutez « m » pour mineur : Rém, Lam
mesure: 4/4
tempo: 90
unite: 1/4           # durée d'une note écrite sans chiffre (1/4 = une noire)
voix:
  - nom: Soprano
    notes: |
      sol la si do' | ré'2 do'2 |
      si la sol2 |]
    paroles: |
      Gra- ce in- fi- nie
      tu me re- lè- ves
`

const SOLFEGE: Record<string, string> = { do: "C", re: "D", mi: "E", fa: "F", sol: "G", la: "A", si: "B" }
const KNOWN_ROOT = new Set(["titre", "compositeur", "tonalite", "mesure", "tempo", "unite", "voix", "notes", "paroles", "nom", "cle"])
const KNOWN_VOICE = new Set(["nom", "notes", "paroles", "cle"])

/** Clé de lecture proposée selon le nom de la voix (modifiable avec `cle:`). */
const CLEFS: [RegExp, string][] = [
  [/basse|bass/i, "bass"],
  [/t[ée]nor/i, "treble-8"],
  [/alto|contralto/i, "treble"],
  [/soprano|dessus/i, "treble"],
]
const VALID_CLEFS = ["treble", "treble-8", "treble+8", "bass", "alto", "tenor", "perc", "none"]

const NOTE_RE = /^([A-Za-zÀ-ÿ]+?)(##|bb|[#b♯♭=]?)(['’,]*)(\d*\/?\d*)(-?)$/
const REST_RE = /^z(\d*\/?\d*)$/
const BAR_RE = /^[|:[\]]+\d?$/
const DURATION_RE = /^(\d+)?(\/\d*)?$/

/** « Voix « Alto » » ; « Partition » quand la voix n'a pas de nom (partition à une voix). */
const who = (nom: string) => (nom === "Voix" ? "Partition" : `Voix « ${nom} »`)

const strip = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "")
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").replace(/%/g, "％").trim().slice(0, 150)

function accidental(a: string): string {
  switch (a) {
    case "#": case "♯": return "^"
    case "##": return "^^"
    case "b": case "♭": return "_"
    case "bb": return "__"
    case "=": return "="
    default: return ""
  }
}

/** Convertit une note « sol#' », « ré2 », « la/2 » ou « C,2 » en ABC ; null si ce n'est pas une note. */
export function noteToAbc(token: string): string | null {
  const m = NOTE_RE.exec(token)
  if (!m) return null
  const [, rawName, acc, marks, duration, tie] = m
  const solfege = SOLFEGE[strip(rawName).toLowerCase()]
  let letter: string
  let octave = 0
  if (solfege) {
    letter = solfege
  } else if (/^[A-Ga-g]$/.test(rawName)) {
    letter = rawName.toUpperCase()
    octave = rawName === rawName.toLowerCase() ? 1 : 0 // convention ABC : minuscule = octave au-dessus
  } else {
    return null
  }
  for (const c of marks) octave += c === "," ? -1 : 1
  if (!DURATION_RE.test(duration)) return null
  const pitch = octave <= 0 ? letter + ",".repeat(-octave) : letter.toLowerCase() + "'".repeat(octave - 1)
  return `${accidental(acc)}${pitch}${duration}${tie}`
}

/** Découpe une ligne de notes en éléments : notes, silences, barres (même collées : « sol|la »). */
function tokenize(line: string): string[] {
  const out: string[] = []
  for (const chunk of line.trim().split(/\s+/).filter(Boolean)) {
    let buf = ""
    let i = 0
    while (i < chunk.length) {
      if ("|:[]".includes(chunk[i])) {
        if (buf) { out.push(buf); buf = "" }
        let bar = ""
        while (i < chunk.length && "|:[]".includes(chunk[i])) bar += chunk[i++]
        if (/\d/.test(chunk[i] ?? "")) bar += chunk[i++] // volta : |1  :|2
        out.push(bar)
      } else {
        buf += chunk[i++]
      }
    }
    if (buf) out.push(buf)
  }
  return out
}

function convertLine(line: string, voiceName: string, errors: string[]): string {
  const result: string[] = []
  for (const tok of tokenize(line)) {
    if (BAR_RE.test(tok)) { result.push(tok); continue }
    const rest = REST_RE.exec(tok)
    if (rest) { result.push(tok); continue }
    const note = noteToAbc(tok)
    if (note === null) {
      errors.push(`${who(voiceName)} : « ${tok} » n'est pas une note valide (exemples : do, ré2, sol#', la/2, si-, z, |).`)
      continue
    }
    result.push(note)
  }
  return result.join(" ")
}

type KeyResult = { ok: true; value: string } | { ok: false; error: string }

/** « Sol », « Rém », « La mineur », « Fa# », « Sib majeur », « G » → champ K: ABC */
function parseKey(raw: string): KeyResult {
  const m = /^\s*(do|re|ré|mi|fa|sol|la|si|[A-Ga-g])\s*([#b♯♭]?)\s*(m|min|mineur|minor|maj|majeur|major)?\s*$/i.exec(raw)
  if (!m) return { ok: false, error: `Tonalité « ${raw} » non reconnue (exemples : Do, Sol, Rém, La mineur, Fa#, Sib).` }
  const name = strip(m[1]).toLowerCase()
  const letter = SOLFEGE[name] ?? name.toUpperCase()
  const acc = m[2] === "#" || m[2] === "♯" ? "#" : m[2] === "b" || m[2] === "♭" ? "b" : ""
  const minor = m[3] && /^(m|min|mineur|minor)$/i.test(m[3])
  return { ok: true, value: `${letter}${acc}${minor ? "m" : ""}` }
}

function asText(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v === "string") return v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  return undefined
}

type VoiceDef = { nom: string; notes: string; paroles: string[] ; cle?: string }

function lyricsList(v: unknown): string[] {
  if (v === undefined || v === null) return []
  const items = Array.isArray(v) ? v : [v]
  return items.map((x) => asText(x) ?? "").filter((x) => x.trim().length > 0)
}

/** Compile une partition YAML en ABC. Ne lève jamais d'exception : renvoie la liste des erreurs lisibles. */
export function compileYamlScore(source: string): CompileResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!source.trim()) return { ok: false, errors: ["La partition est vide."] }
  if (source.length > MAX_YAML_CHARS) return { ok: false, errors: [`La partition est trop longue (${MAX_YAML_CHARS} caractères maximum).`] }

  const doc = parseDocument(source)
  if (doc.errors.length > 0) {
    return {
      ok: false,
      errors: doc.errors.slice(0, 5).map((e) => {
        const line = e.linePos?.[0]?.line
        return `Erreur de syntaxe YAML${line ? ` (ligne ${line})` : ""} : ${e.message.split("\n")[0]}. Vérifiez l'indentation et l'espace après chaque « : ».`
      }),
    }
  }
  let root: unknown
  try {
    root = doc.toJS({ maxAliasCount: 10 })
  } catch {
    return { ok: false, errors: ["Le YAML utilise trop de références (alias « * » / ancres « & ») : simplifiez-le."] }
  }
  if (!root || typeof root !== "object" || Array.isArray(root)) {
    return { ok: false, errors: ["Le YAML doit être une suite de « clé: valeur » (titre, tonalite, mesure, voix…)."] }
  }
  const r = root as Record<string, unknown>
  for (const k of Object.keys(r)) {
    if (!KNOWN_ROOT.has(k)) warnings.push(`Clé inconnue « ${k} » ignorée (clés connues : titre, compositeur, tonalite, mesure, tempo, unite, voix).`)
  }

  // --- en-tête
  const titre = oneLine(asText(r.titre) ?? "Sans titre")
  const compositeur = asText(r.compositeur) ? oneLine(asText(r.compositeur)!) : ""

  let keyAbc = "C"
  if (asText(r.tonalite)) {
    const k = parseKey(asText(r.tonalite)!)
    if (k.ok) keyAbc = k.value
    else errors.push(k.error)
  }

  const mesure = (asText(r.mesure) ?? "4/4").trim()
  if (!/^(\d{1,2}\/\d{1,2}|C\|?)$/.test(mesure)) errors.push(`Mesure « ${mesure} » non reconnue (exemples : 4/4, 3/4, 6/8).`)

  const unite = (asText(r.unite) ?? "1/4").trim()
  if (!/^\d{1,2}\/\d{1,2}$/.test(unite)) errors.push(`Unité « ${unite} » non reconnue (exemples : 1/4 pour une noire, 1/8 pour une croche).`)

  let tempo: number | null = null
  if (r.tempo !== undefined && r.tempo !== null) {
    const t = Number(asText(r.tempo))
    if (!Number.isInteger(t) || t < 20 || t > 300) errors.push("Le tempo doit être un nombre entier entre 20 et 300 (battements par minute).")
    else tempo = t
  }

  // --- voix
  const voices: VoiceDef[] = []
  const rawVoices = r.voix
  const pushVoice = (nom: string, v: Record<string, unknown>) => {
    for (const k of Object.keys(v)) if (!KNOWN_VOICE.has(k)) warnings.push(`${who(nom)} : clé inconnue « ${k} » ignorée.`)
    const notes = asText(v.notes)
    if (!notes || !notes.trim()) { errors.push(`${who(nom)} : « notes » est vide ou manquant.`); return }
    voices.push({ nom, notes, paroles: lyricsList(v.paroles), cle: asText(v.cle)?.trim() })
  }

  if (Array.isArray(rawVoices)) {
    rawVoices.forEach((v, i) => {
      if (!v || typeof v !== "object" || Array.isArray(v)) errors.push(`Voix n°${i + 1} : écrivez « nom: », « notes: » et « paroles: » sous un tiret.`)
      else {
        const vo = v as Record<string, unknown>
        pushVoice(oneLine(asText(vo.nom) ?? `Voix ${i + 1}`), vo)
      }
    })
  } else if (rawVoices && typeof rawVoices === "object") {
    for (const [nom, v] of Object.entries(rawVoices as Record<string, unknown>)) {
      if (!v || typeof v !== "object" || Array.isArray(v)) errors.push(`${who(nom)} : écrivez « notes: » et « paroles: » en dessous.`)
      else pushVoice(oneLine(nom), v as Record<string, unknown>)
    }
  } else if (r.notes !== undefined) {
    pushVoice(oneLine(asText(r.nom) ?? "Voix"), r) // partition à une voix : notes/paroles à la racine
  } else {
    errors.push("Aucune voix : ajoutez « voix: » (liste) ou « notes: » directement.")
  }
  if (voices.length === 0 && errors.length === 0) errors.push("Aucune voix : ajoutez au moins une voix avec ses « notes: ».")
  if (voices.length > 8) errors.push("8 voix maximum.")

  // --- corps
  const bodies: string[] = []
  for (const v of voices) {
    const noteLines = v.notes.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const converted = noteLines.map((l) => convertLine(l, v.nom, errors))
    const verses = v.paroles.map((p) => p.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))

    // Paroles alignées ligne à ligne si chaque couplet a autant de lignes que les notes ; sinon tout sur une ligne
    const aligned = converted.length > 1 && verses.length > 0 && verses.every((vs) => vs.length === converted.length)
    const lines: string[] = []
    if (aligned) {
      converted.forEach((music, i) => {
        lines.push(music)
        for (const vs of verses) lines.push(`w: ${vs[i].replace(/%/g, "％")}`)
      })
    } else {
      lines.push(converted.join(" "))
      for (const vs of verses) lines.push(`w: ${vs.join(" ").replace(/%/g, "％")}`)
    }

    if (v.cle && !VALID_CLEFS.includes(v.cle)) errors.push(`${who(v.nom)} : clé « ${v.cle} » inconnue (${VALID_CLEFS.join(", ")}).`)
    bodies.push(lines.join("\n"))
  }

  if (errors.length > 0) return { ok: false, errors: errors.slice(0, 12) }

  // --- assemblage ABC
  const head = ["X:1", `T:${titre}`]
  if (compositeur) head.push(`C:${compositeur}`)
  head.push(`M:${mesure}`, `L:${unite}`)
  if (tempo !== null) head.push(`Q:${unite}=${tempo}`)

  const clefOf = (v: VoiceDef) => v.cle ?? CLEFS.find(([re]) => re.test(v.nom))?.[1] ?? "treble"
  const out = [...head]
  if (voices.length > 1) {
    out.push(`%%score ${voices.map((_, i) => i + 1).join(" ")}`)
    voices.forEach((v, i) => out.push(`V:${i + 1} name="${v.nom.replace(/"/g, "'")}" clef=${clefOf(v)}`))
    out.push(`K:${keyAbc}`)
    voices.forEach((_, i) => out.push(`V:${i + 1}`, bodies[i]))
  } else {
    const clef = clefOf(voices[0])
    out.push(`K:${keyAbc}${clef !== "treble" ? ` clef=${clef}` : ""}`, bodies[0])
  }

  return { ok: true, abc: out.join("\n") + "\n", warnings }
}
