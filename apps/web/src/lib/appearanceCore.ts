import accentData from "./accents.json"

/** Réglages d'apparence propres à l'appareil (hors thème clair/sombre, géré par theme.ts). */
export const ACCENT_IDS = Object.keys(accentData.accents)
export const DEFAULT_ACCENT = accentData.default
export const TEXT_SIZES = ["normal", "large", "xlarge"] as const
export const LYRICS_FONTS = ["sans", "serif"] as const
export const MOTIONS = ["auto", "reduce"] as const

export type Appearance = {
  accent: string
  textSize: (typeof TEXT_SIZES)[number]
  lyricsFont: (typeof LYRICS_FONTS)[number]
  motion: (typeof MOTIONS)[number]
}

export const DEFAULT_APPEARANCE: Appearance = {
  accent: DEFAULT_ACCENT,
  textSize: "normal",
  lyricsFont: "sans",
  motion: "auto",
}

export const STORAGE_KEY = "cp-ui"

function pick<T extends readonly string[]>(list: T, v: unknown, fallback: T[number]): T[number] {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : fallback
}

/** Valide des réglages issus du stockage (ancien format, valeur altérée…) : toute valeur inconnue → défaut. */
export function parseAppearance(raw: string | null | undefined): Appearance {
  if (!raw) return DEFAULT_APPEARANCE
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    return {
      accent: pick(ACCENT_IDS, o.accent, DEFAULT_ACCENT),
      textSize: pick(TEXT_SIZES, o.textSize, "normal"),
      lyricsFont: pick(LYRICS_FONTS, o.lyricsFont, "sans"),
      motion: pick(MOTIONS, o.motion, "auto"),
    }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

/** Attributs posés sur <html> (les valeurs par défaut n'ajoutent aucun attribut). */
export function appearanceAttributes(a: Appearance): Record<string, string | null> {
  return {
    "data-accent": a.accent === DEFAULT_ACCENT ? null : a.accent,
    "data-text": a.textSize === "normal" ? null : a.textSize,
    "data-lyrics": a.lyricsFont === "sans" ? null : a.lyricsFont,
    "data-motion": a.motion === "auto" ? null : a.motion,
  }
}
