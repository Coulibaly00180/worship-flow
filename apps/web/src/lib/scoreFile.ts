export const MAX_SCORE_BYTES = 8 * 1024 * 1024

export type ScoreMime = "application/pdf" | "image/png" | "image/jpeg"

/** Détecte le type réel via les magic bytes (on ne fait jamais confiance au type déclaré). */
export function detectScoreType(b: Uint8Array): ScoreMime | null {
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) {
    return "application/pdf"
  }
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png"
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg"
  return null
}

/** Nettoie un nom de fichier utilisateur (pas de chemin, longueur bornée). */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "partition"
  const clean = base.replace(/[^\p{L}\p{N}._ ()-]/gu, "_").trim().slice(0, 120)
  return clean || "partition"
}

// ── Voix et partitions en notation ABC ───────────────────────────────────────

export const VOICES = ["ALL", "SOPRANO", "ALTO", "TENOR", "BASSE", "ACCOMPAGNEMENT"] as const
export type Voice = (typeof VOICES)[number]

export const VOICE_LABEL: Record<Voice, string> = {
  ALL: "Toutes voix",
  SOPRANO: "Soprano",
  ALTO: "Alto",
  TENOR: "Ténor",
  BASSE: "Basse",
  ACCOMPAGNEMENT: "Accompagnement",
}

export function isVoice(v: unknown): v is Voice {
  return typeof v === "string" && (VOICES as readonly string[]).includes(v)
}

export const MAX_ABC_CHARS = 100_000

/** Modèle proposé pour une nouvelle partition (4/4, Do majeur). */
export const ABC_TEMPLATE = `X:1
T:Titre
M:4/4
L:1/4
Q:1/4=90
K:C
C D E F | G A B c | c B A G | F E D C |]
w: la la la la la la la la la la la la la la la la
`
