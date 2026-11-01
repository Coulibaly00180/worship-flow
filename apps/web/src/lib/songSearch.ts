import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"

const MAX_TERMS = 6
const MAX_RESULTS = 500

export const LEARNING_STATUSES = ["TO_LEARN", "IN_PROGRESS", "MASTERED"] as const
export type LearningFilter = (typeof LEARNING_STATUSES)[number]

export type SongFilters = {
  q?: string
  letter?: string
  status?: string
  favorite?: boolean
  withScore?: boolean
  tag?: string
}

/** Découpe la saisie en mots (tous doivent être présents). */
export function searchTerms(q: string): string[] {
  return q
    .normalize("NFC")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, MAX_TERMS)
}

/** Motif ILIKE : échappe \, % et _ saisis par l'utilisateur. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, "\\$&")}%`
}

/**
 * Recherche plein texte tolérante aux accents et à la casse (extension PostgreSQL `unaccent`)
 * dans le titre, l'artiste, les étiquettes ET les paroles. Les chants dont le titre correspond
 * passent en premier. Retourne les ids dans l'ordre de pertinence.
 */
export async function searchSongIds(q: string): Promise<string[]> {
  const terms = searchTerms(q)
  if (terms.length === 0) return []

  const matches = terms.map((t) => {
    const p = likePattern(t)
    return Prisma.sql`(
      unaccent(s."title") ILIKE unaccent(${p})
      OR unaccent(coalesce(s."artist", '')) ILIKE unaccent(${p})
      OR unaccent(coalesce(s."tags", '')) ILIKE unaccent(${p})
      OR EXISTS (
        SELECT 1 FROM "SongBlock" b
        WHERE b."songId" = s."id" AND unaccent(b."content") ILIKE unaccent(${p})
      )
    )`
  })
  const titleHits = terms.map((t) => Prisma.sql`(unaccent(s."title") ILIKE unaccent(${likePattern(t)}))::int`)

  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT s."id"
    FROM "Song" s
    WHERE s."deletedAt" IS NULL AND ${Prisma.join(matches, " AND ")}
    ORDER BY (${Prisma.join(titleHits, " + ")}) DESC, s."title" ASC
    LIMIT ${MAX_RESULTS}
  `)
  return rows.map((r) => r.id)
}

/** Construit le filtre Prisma + l'ordre de pertinence éventuel pour la liste des chants. */
export async function buildSongQuery(
  userId: string,
  f: SongFilters,
): Promise<{ where: Prisma.SongWhereInput; rank: string[] | null }> {
  const where: Prisma.SongWhereInput = { deletedAt: null }
  let rank: string[] | null = null

  const q = f.q?.trim()
  if (q) {
    rank = await searchSongIds(q)
    where.id = { in: rank }
  } else if (f.letter) {
    where.title = { startsWith: f.letter, mode: "insensitive" }
  }

  if (f.favorite) where.favorites = { some: { userId } }
  if (f.withScore) where.scores = { some: {} }
  if (f.status && (LEARNING_STATUSES as readonly string[]).includes(f.status)) {
    where.learnings = { some: { userId, status: f.status as LearningFilter } }
  }
  const tag = f.tag?.trim()
  if (tag) where.tags = { contains: `"${tag.replace(/"/g, "")}"`, mode: "insensitive" }

  return { where, rank }
}

/** Réordonne `items` selon `rank` (ids par pertinence) ; sans rang, laisse l'ordre inchangé. */
export function sortByRank<T extends { id: string }>(items: T[], rank: string[] | null): T[] {
  if (!rank) return items
  const pos = new Map(rank.map((id, i) => [id, i]))
  return [...items].sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0))
}
