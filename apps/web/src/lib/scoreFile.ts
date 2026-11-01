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
