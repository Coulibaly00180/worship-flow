/**
 * Extraction d'une ou plusieurs voix d'une partition ABC multivoix (par exemple pour n'afficher et
 * n'écouter que le soprano sur téléphone). Fonctionne sur les ABC « à déclarations » (V: définies
 * dans l'en-tête, puis lignes « V:n » dans le corps), ce que produit le compilateur YAML ;
 * les ABC écrits à la main avec des voix en ligne ([V:1]) ne sont pas filtrables.
 */

export type AbcVoice = { id: string; name: string }

const VOICE_DEF_RE = /^V:\s*(\S+)(.*)$/
const VOICE_SWITCH_RE = /^V:\s*(\S+)\s*$/
const NAME_RE = /(?:name|nm)\s*=\s*"([^"]*)"/

function splitHeader(lines: string[]): { header: string[]; body: string[] } {
  const k = lines.findIndex((l) => /^K:/.test(l))
  if (k === -1) return { header: lines, body: [] }
  return { header: lines.slice(0, k + 1), body: lines.slice(k + 1) }
}

/** Voix déclarées dans l'en-tête ; tableau vide s'il y en a moins de deux (rien à filtrer). */
export function listAbcVoices(abc: string): AbcVoice[] {
  const { header } = splitHeader(abc.split("\n"))
  const voices: AbcVoice[] = []
  for (const line of header) {
    const m = VOICE_DEF_RE.exec(line)
    if (m && !voices.some((v) => v.id === m[1])) voices.push({ id: m[1], name: NAME_RE.exec(m[2])?.[1] ?? `Voix ${m[1]}` })
  }
  return voices.length >= 2 ? voices : []
}

/** Garde uniquement les voix `keepIds` (dans l'ordre d'origine). Sans filtre applicable, renvoie l'ABC inchangé. */
export function filterAbcVoices(abc: string, keepIds: string[]): string {
  const voices = listAbcVoices(abc)
  if (voices.length === 0) return abc
  const keep = new Set(keepIds.filter((id) => voices.some((v) => v.id === id)))
  if (keep.size === 0 || keep.size === voices.length) return abc

  const { header, body } = splitHeader(abc.split("\n"))
  const kept = voices.filter((v) => keep.has(v.id)).map((v) => v.id)

  const outHeader: string[] = []
  for (const line of header) {
    const def = VOICE_DEF_RE.exec(line)
    if (def) {
      if (keep.has(def[1])) outHeader.push(line)
      continue
    }
    if (/^%%(score|staves)\b/.test(line)) {
      if (kept.length > 1) outHeader.push(`%%score ${kept.join(" ")}`)
      continue
    }
    outHeader.push(line)
  }

  const outBody: string[] = []
  let current: string | null = null
  for (const line of body) {
    const sw = VOICE_SWITCH_RE.exec(line)
    if (sw) {
      current = sw[1]
      if (keep.has(current)) outBody.push(line)
      continue
    }
    if (current === null || keep.has(current)) outBody.push(line)
  }
  return [...outHeader, ...outBody].join("\n")
}

const PREF_PATTERNS: Record<string, RegExp> = {
  SOPRANO: /soprano|dessus/i,
  ALTO: /alto|contralto/i,
  TENOR: /t[ée]nor/i,
  BASSE: /basse|bass|baryton/i,
}

/** Retrouve la voix correspondant à une préférence (SOPRANO, ALTO, TENOR, BASSE) d'après son nom. */
export function matchVoiceId(voices: AbcVoice[], preferred: string): string | null {
  const re = PREF_PATTERNS[preferred]
  if (!re) return null
  return voices.find((v) => re.test(v.name))?.id ?? null
}

/** Préférence (SOPRANO, ALTO, TENOR, BASSE) correspondant au nom d'une voix ; null pour une voix au nom libre. */
export function voicePrefKey(name: string): string | null {
  return Object.keys(PREF_PATTERNS).find((k) => PREF_PATTERNS[k].test(name)) ?? null
}
