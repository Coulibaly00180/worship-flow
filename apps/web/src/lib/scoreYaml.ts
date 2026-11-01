import { parseDocument } from "yaml"
import { chordToEnglish } from "@/lib/chords"

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

/** Exemple complet : 4 voix, accords, nuances, volta, signes de reprise, texte, décalage d'octave. */
export const YAML_EXAMPLE_FULL = `titre: Exemple complet
compositeur: Équipe louange
tonalite: Sol
mesure: 4/4
tempo: 84
voix:
  - nom: Soprano
    notes: |
      !mp @Sol sol la si do' | !cresc( @Do ré'2 mi'2 | !cresc) !f @Ré7 ré'4 | @Sol sol4 |1 z4 :|2 !fermata sol4 |]
    paroles: |
      Gra- ce in- fi- nie
  - nom: Alto
    notes: sol, la, si, do | ré2 mi2 | ré4 | sol,4 |1 z4 :|2 sol,4 |]
  - nom: Ténor
    notes: sol la si do' | ré'2 mi'2 | ré'4 | sol4 |1 z4 :|2 sol4 |]
  - nom: Basse
    octave: -1          # mêmes notes que le ténor, une octave plus bas
    notes: sol la si do' | ré'2 mi'2 | ré'4 | sol4 |1 z4 :|2 sol4 |]
`

const SOLFEGE: Record<string, string> = { do: "C", re: "D", mi: "E", fa: "F", sol: "G", la: "A", si: "B" }
const KNOWN_ROOT = new Set(["titre", "compositeur", "tonalite", "mesure", "tempo", "unite", "voix", "notes", "paroles", "nom", "cle", "octave"])
const KNOWN_VOICE = new Set(["nom", "notes", "paroles", "cle", "octave"])

/** Clé de lecture proposée selon le nom de la voix (modifiable avec `cle:`). */
const CLEFS: [RegExp, string][] = [
  [/basse|bass/i, "bass"],
  [/t[ée]nor/i, "treble-8"],
  [/alto|contralto/i, "treble"],
  [/soprano|dessus/i, "treble"],
]
const VALID_CLEFS = ["treble", "treble-8", "treble+8", "bass", "alto", "tenor", "perc", "none"]

/** Tessitures usuelles (hauteurs MIDI écrites, marge comprise) : au-delà, on avertit sans bloquer. */
type Range = { re: RegExp; label: string; min: number; max: number }
const RANGES: Range[] = [
  { re: /soprano|dessus/i, label: "soprano", min: 57, max: 84 },
  { re: /alto|contralto/i, label: "alto", min: 52, max: 79 },
  { re: /t[ée]nor/i, label: "ténor", min: 57, max: 83 },
  { re: /basse|bass/i, label: "basse", min: 36, max: 67 },
]
const HUMAN_RANGE = { min: 28, max: 91 }
const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const ACC_VALUE: Record<string, number> = { "#": 1, "♯": 1, "##": 2, b: -1, "♭": -1, bb: -2, "=": 0, "": 0 }

/** Nuances, ornements et signes de reprise : « !mf », « !cresc( », « !segno »… */
const DECORATIONS: Record<string, string> = {
  ppp: "ppp", pp: "pp", p: "p", mp: "mp", mf: "mf", f: "f", ff: "ff", fff: "fff", sfz: "sfz",
  "cresc(": "crescendo(", "cresc)": "crescendo)", "dim(": "diminuendo(", "dim)": "diminuendo)",
  fermata: "fermata", accent: "accent", staccato: "staccato", trille: "trill",
  segno: "segno", coda: "coda", dc: "D.C.", ds: "D.S.", fine: "fine", dacoda: "dacoda", dacapo: "dacapo",
}

const NOTE_RE = /^([A-Za-zÀ-ÿ]+?)(##|bb|[#b♯♭=]?)(['’,]*)(\d*\/?\d*)(-?)$/
const REST_RE = /^z(\d*\/?\d*)$/
const BAR_RE = /^[|:[\]]+\d?$/
const DURATION_RE = /^(\d+)?(\/\d*)?$/
const DECORATION_RE = /^!([a-zA-Z]+[()]?)$/
const ANNOTATION_RE = /^\^([\p{L}\p{N}_.,'’()!?-]{1,40})$/u
const CHORD_RE = /^@(.{1,24})$/

/** « Voix « Alto » » ; « Partition » quand la voix n'a pas de nom (partition à une voix). */
const who = (nom: string) => (nom === "Voix" ? "Partition" : `Voix « ${nom} »`)

const strip = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "")
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").replace(/%/g, "％").trim().slice(0, 150)

type ParsedNote = { letter: string; acc: string; octave: number; duration: string; tie: string }

function accidentalAbc(a: string): string {
  switch (a) {
    case "#": case "♯": return "^"
    case "##": return "^^"
    case "b": case "♭": return "_"
    case "bb": return "__"
    case "=": return "="
    default: return ""
  }
}

/** Analyse « sol#' », « ré2 », « la/2 » ou « C,2 ». `octave` : 0 = octave du do central ; `shift` décale la voix. */
function parseNote(token: string, shift = 0): ParsedNote | null {
  const m = NOTE_RE.exec(token)
  if (!m) return null
  const [, rawName, acc, marks, duration, tie] = m
  const solfege = SOLFEGE[strip(rawName).toLowerCase()]
  let letter: string
  let octave = shift
  if (solfege) {
    letter = solfege
  } else if (/^[A-Ga-g]$/.test(rawName)) {
    letter = rawName.toUpperCase()
    if (rawName === rawName.toLowerCase()) octave += 1 // convention ABC : minuscule = octave au-dessus
  } else {
    return null
  }
  for (const c of marks) octave += c === "," ? -1 : 1
  if (!DURATION_RE.test(duration)) return null
  return { letter, acc, octave, duration, tie }
}

function renderNote(n: ParsedNote): string {
  const pitch = n.octave <= 0 ? n.letter + ",".repeat(-n.octave) : n.letter.toLowerCase() + "'".repeat(n.octave - 1)
  return `${accidentalAbc(n.acc)}${pitch}${n.duration}${n.tie}`
}

/** Convertit une note en ABC ; null si ce n'est pas une note. */
export function noteToAbc(token: string, shift = 0): string | null {
  const n = parseNote(token, shift)
  return n ? renderNote(n) : null
}

/** Hauteur MIDI (do central = 60) d'une note analysée. */
function midiOf(n: ParsedNote): number {
  return 60 + SEMITONE[n.letter] + (ACC_VALUE[n.acc] ?? 0) + 12 * n.octave
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

type LineCtx = { voice: string; shift: number; errors: string[]; range: Range | null; outOfRange: { token: string; high: boolean }[] }

function convertLine(line: string, ctx: LineCtx): string {
  const result: string[] = []
  let prefix = "" // accords, nuances et textes : s'appliquent à la prochaine note ou au prochain silence
  let lastPrefixToken = ""

  for (const tok of tokenize(line)) {
    if (BAR_RE.test(tok)) { result.push(tok); continue }

    const chord = CHORD_RE.exec(tok)
    if (chord) {
      const en = chordToEnglish(chord[1])
      if (!en) ctx.errors.push(`${who(ctx.voice)} : « ${tok} » n'est pas un accord (exemples : @Sol, @Rém7, @Sib/Fa, @La7).`)
      else { prefix += `"${en}"`; lastPrefixToken = tok }
      continue
    }
    const deco = DECORATION_RE.exec(tok)
    if (deco) {
      const abc = DECORATIONS[deco[1].toLowerCase()]
      if (!abc) ctx.errors.push(`${who(ctx.voice)} : « ${tok} » est inconnu (disponibles : ${Object.keys(DECORATIONS).map((k) => "!" + k).join(", ")}).`)
      else { prefix += `!${abc}!`; lastPrefixToken = tok }
      continue
    }
    const ann = ANNOTATION_RE.exec(tok)
    if (ann) { prefix += `"^${ann[1].replace(/_/g, " ").replace(/"/g, "'")}"`; lastPrefixToken = tok; continue } // "^texte" = texte au-dessus de la portée

    if (REST_RE.test(tok)) { result.push(prefix + tok); prefix = ""; continue }

    const note = parseNote(tok, ctx.shift)
    if (!note) {
      ctx.errors.push(`${who(ctx.voice)} : « ${tok} » n'est pas une note valide (exemples : do, ré2, sol#', la/2, si-, z, |).`)
      continue
    }
    const midi = midiOf(note)
    const limits = ctx.range ?? HUMAN_RANGE
    if (midi < limits.min || midi > limits.max) ctx.outOfRange.push({ token: tok, high: midi > limits.max })
    result.push(prefix + renderNote(note))
    prefix = ""
  }

  if (prefix) ctx.errors.push(`${who(ctx.voice)} : « ${lastPrefixToken} » doit être suivi d'une note ou d'un silence sur la même ligne.`)
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

type VoiceDef = { nom: string; notes: string; paroles: string[]; cle?: string; octave: number }

function lyricsList(v: unknown): string[] {
  if (v === undefined || v === null) return []
  const items = Array.isArray(v) ? v : [v]
  return items.map((x) => asText(x) ?? "").filter((x) => x.trim().length > 0)
}

/** Décalage d'octave (-3 à 3) ; undefined si absent, null si invalide. */
function parseOctave(v: unknown): number | undefined | null {
  if (v === undefined || v === null) return undefined
  const n = Number(asText(v))
  return Number.isInteger(n) && n >= -3 && n <= 3 ? n : null
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
    if (!KNOWN_ROOT.has(k)) warnings.push(`Clé inconnue « ${k} » ignorée (clés connues : titre, compositeur, tonalite, mesure, tempo, unite, octave, voix).`)
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

  const globalOctave = parseOctave(r.octave)
  if (globalOctave === null) errors.push("« octave » doit être un entier entre -3 et 3 (par exemple -1 pour descendre d'une octave).")

  // --- voix
  const voices: VoiceDef[] = []
  const rawVoices = r.voix
  const pushVoice = (nom: string, v: Record<string, unknown>) => {
    for (const k of Object.keys(v)) if (!KNOWN_VOICE.has(k)) warnings.push(`${who(nom)} : clé inconnue « ${k} » ignorée.`)
    const notes = asText(v.notes)
    if (!notes || !notes.trim()) { errors.push(`${who(nom)} : « notes » est vide ou manquant.`); return }
    const oct = parseOctave(v.octave)
    if (oct === null) { errors.push(`${who(nom)} : « octave » doit être un entier entre -3 et 3.`); return }
    voices.push({ nom, notes, paroles: lyricsList(v.paroles), cle: asText(v.cle)?.trim(), octave: oct ?? globalOctave ?? 0 })
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
    const ctx: LineCtx = {
      voice: v.nom,
      shift: v.octave,
      errors,
      range: RANGES.find((x) => x.re.test(v.nom)) ?? null,
      outOfRange: [],
    }
    const noteLines = v.notes.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const converted = noteLines.map((l) => convertLine(l, ctx))
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

    if (ctx.outOfRange.length > 0) {
      const first = ctx.outOfRange[0]
      const n = ctx.outOfRange.length
      const where = ctx.range ? `pour une voix de ${ctx.range.label}` : "pour une voix humaine"
      warnings.push(
        `${who(v.nom)} : « ${first.token} »${n > 1 ? ` (et ${n - 1} autre${n > 2 ? "s" : ""})` : ""} semble trop ${first.high ? "aigu" : "grave"} ${where}. ` +
          `Vérifiez l'octave ; « octave: ${first.high ? "-1" : "1"} » sous la voix décale toutes ses notes.`,
      )
    }
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
