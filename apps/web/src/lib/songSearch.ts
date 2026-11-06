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
      OR unaccent(array_to_string(s."tags", ' ')) ILIKE unaccent(${p})
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
  if (tag) where.tags = { has: tag }

  return { where, rank }
}

/** Réordonne `items` selon `rank` (ids par pertinence) ; sans rang, laisse l'ordre inchangé. */
export function sortByRank<T extends { id: string }>(items: T[], rank: string[] | null): T[] {
  if (!rank) return items
  const pos = new Map(rank.map((id, i) => [id, i]))
  return [...items].sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0))
}

export const SONG_PAGE_SIZE = 60
export const MAX_PAGE_SIZE = 200

/** Numéro de page (1-based) lu dans une chaîne de requête ; toute valeur invalide donne 1. */
export function parsePage(raw: string | null | undefined): number {
  const n = Number.parseInt(raw ?? "", 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1
}

/** Taille de page bornée [1, MAX_PAGE_SIZE]. */
export function parsePageSize(raw: string | null | undefined, fallback = SONG_PAGE_SIZE): number {
  const n = Number.parseInt(raw ?? "", 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_PAGE_SIZE) : fallback
}

export type PageMeta = { page: number; pageSize: number; total: number; pageCount: number }

export function pageMeta(page: number, pageSize: number, total: number): PageMeta {
  return { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) }
}

/**
 * Charge une page de chants. Avec une recherche (rang de pertinence, ≤ 500 ids), le tri se fait
 * en mémoire puis on découpe ; sans recherche, la pagination est faite par la base (skip/take).
 */
export async function findSongPage<T extends { id: string }>(
  where: Prisma.SongWhereInput,
  rank: string[] | null,
  page: number,
  pageSize: number,
  find: (args: { where: Prisma.SongWhereInput; skip?: number; take?: number }) => Promise<T[]>,
): Promise<{ items: T[]; meta: PageMeta }> {
  if (rank) {
    const all = sortByRank(await find({ where }), rank)
    return { items: all.slice((page - 1) * pageSize, page * pageSize), meta: pageMeta(page, pageSize, all.length) }
  }
  const [items, total] = await Promise.all([
    find({ where, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.song.count({ where }),
  ])
  return { items, meta: pageMeta(page, pageSize, total) }
}
