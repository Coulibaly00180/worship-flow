import { z } from "zod"
import { ACCENT_IDS, LYRICS_FONTS, MOTIONS, TEXT_SIZES, type Appearance } from "@/lib/appearanceCore"

/** Réglages d'apparence tels qu'échangés avec le serveur (un exemplaire par compte). */
export type SyncPayload = {
  appearance: Appearance
  theme: "system" | "light" | "dark"
  /** Horodatage (ms) de la dernière modification volontaire, sur n'importe quel appareil. */
  updatedAt: number
}

/** Schéma strict : toute valeur hors liste est refusée (rien d'inattendu n'est stocké ni réinjecté dans <html>). */
export const SyncPayloadSchema = z.object({
  appearance: z.object({
    accent: z.enum(ACCENT_IDS as [string, ...string[]]),
    textSize: z.enum(TEXT_SIZES),
    lyricsFont: z.enum(LYRICS_FONTS),
    motion: z.enum(MOTIONS),
  }),
  theme: z.enum(["system", "light", "dark"]),
  updatedAt: z.number().int().nonnegative(),
})

export type SyncDecision = "pull" | "push" | "none"

/**
 * Décide quoi faire en comparant la copie locale et celle du serveur : la plus récente gagne.
 * - `local` est null si cet appareil n'a jamais été personnalisé (ou appartient à un autre compte) ;
 * - `server` est null si le compte n'a encore rien enregistré.
 */
export function decideSync(local: { updatedAt: number } | null, server: { updatedAt: number } | null): SyncDecision {
  if (!server) return local && local.updatedAt > 0 ? "push" : "none"
  if (!local || local.updatedAt === 0) return "pull"
  if (server.updatedAt > local.updatedAt) return "pull"
  if (server.updatedAt < local.updatedAt) return "push"
  return "none"
}

/** Parse le JSON stocké en base ; null si absent, corrompu ou invalide. */
/** Relit les réglages stockés (colonne JSONB ; une chaîne JSON est aussi acceptée). */
export function parseStoredPrefs(raw: unknown): SyncPayload | null {
  if (raw === null || raw === undefined || raw === "") return null
  let value: unknown = raw
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw)
    } catch {
      return null
    }
  }
  const parsed = SyncPayloadSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
