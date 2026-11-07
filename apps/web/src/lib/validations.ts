import { z } from "zod"

export const MAX_BLOCKS = 60
export const MAX_TAGS = 20

export const SongBlockSchema = z.object({
  label: z.string().min(1, "Label requis").max(100, "Label trop long"),
  type: z.enum(["VERSE", "CHORUS", "BRIDGE", "INTRO", "OUTRO", "OTHER"]),
  content: z.string().min(1, "Paroles requises").max(20_000, "Bloc trop long"),
  order: z.number().int().min(0),
})

/** Découpe/normalise des étiquettes : tableau, JSON « ["a","b"] » (ancien format) ou « a, b ». */
export function normalizeTags(raw: unknown): string[] {
  let list: unknown[] = []
  if (Array.isArray(raw)) list = raw
  else if (typeof raw === "string") {
    const t = raw.trim()
    if (t.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(t)
        if (Array.isArray(parsed)) list = parsed
      } catch {
        list = []
      }
    } else list = t.split(",")
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of list) {
    if (typeof item !== "string") continue
    const tag = item.trim().slice(0, 40)
    const key = tag.toLocaleLowerCase("fr")
    if (!tag || seen.has(key)) continue
    seen.add(key)
    out.push(tag)
  }
  return out
}

const TagsSchema = z.preprocess(
  (v) => (v === undefined || v === null ? v : normalizeTags(v)),
  z.array(z.string()).max(MAX_TAGS, `${MAX_TAGS} étiquettes maximum`).optional(),
)

const optionalText = (max: number) => z.string().trim().max(max).optional()

export const CreateSongSchema = z.object({
  title: z.string().trim().min(1, "Titre requis").max(200, "Titre trop long"),
  artist: optionalText(200),
  album: optionalText(200),
  year: optionalText(20),
  language: optionalText(50),
  tags: TagsSchema,
  blocks: z.array(SongBlockSchema).min(1, "Au moins un bloc requis").max(MAX_BLOCKS, "Trop de blocs"),
})

export const UpdateSongSchema = CreateSongSchema.partial().extend({
  blocks: z.array(SongBlockSchema).min(1, "Au moins un bloc requis").max(MAX_BLOCKS, "Trop de blocs").optional(),
})

export const CreateUserSchema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName:  z.string().min(1, "Nom requis"),
  username:  z.string().min(3, "Pseudo minimum 3 caractères").max(40, "Pseudo trop long").regex(/^[a-z0-9_.-]+$/i, "Pseudo : lettres, chiffres, _ . - uniquement"),
  email:     z.string().trim().toLowerCase().email("Email invalide"),
  password:  z.string().min(8, "Mot de passe minimum 8 caractères").max(200, "Mot de passe trop long"),
  role:      z.enum(["ADMIN", "RESPONSABLE_CHANTRE", "CHANTRE", "LECTEUR"]).default("CHANTRE"),
})

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
    newPassword: z.string().min(8, "Nouveau mot de passe minimum 8 caractères"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  })
