/**
 * Limiteur de tentatives de connexion.
 *
 * Deux magasins :
 *  - "database" (défaut) : table `LoginThrottle` dans PostgreSQL, partagée entre toutes les
 *    instances (Vercel serverless, plusieurs réplicas Docker). Fenêtre fixe, mise à jour atomique.
 *  - "memory" : en mémoire, local au processus (tests, ou `RATE_LIMIT_STORE=memory`).
 *
 * Le choix se fait avec la variable d'environnement RATE_LIMIT_STORE (database | memory).
 */
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"

export const MAX_FAILURES = 5
export const WINDOW_MS = 15 * 60 * 1000
export const LOCK_MS = 15 * 60 * 1000

export interface RateLimitStore {
  /** Ms restantes de blocage (0 = autorisé). */
  lockRemaining(key: string, now: number): Promise<number>
  recordFailure(key: string, now: number, max: number): Promise<void>
  recordSuccess(key: string): Promise<void>
  reset(): Promise<void>
}

// ── Magasin mémoire (fenêtre glissante) ─────────────────────────────────────

type Entry = { failures: number[]; lockedUntil: number }
const MAX_KEYS = 10_000

export function createMemoryStore(): RateLimitStore {
  const store = new Map<string, Entry>()

  function prune(now: number) {
    if (store.size < MAX_KEYS) return
    for (const [key, entry] of store) {
      if (entry.lockedUntil < now && entry.failures.every((t) => now - t > WINDOW_MS)) store.delete(key)
    }
    // Garde-fou mémoire : si toujours plein, on repart de zéro plutôt que de grossir sans limite
    if (store.size >= MAX_KEYS) store.clear()
  }

  return {
    async lockRemaining(key, now) {
      const entry = store.get(key)
      return entry ? Math.max(0, entry.lockedUntil - now) : 0
    },
    async recordFailure(key, now, max) {
      prune(now)
      const entry = store.get(key) ?? { failures: [], lockedUntil: 0 }
      entry.failures = entry.failures.filter((t) => now - t <= WINDOW_MS)
      entry.failures.push(now)
      if (entry.failures.length >= max) {
        entry.lockedUntil = now + LOCK_MS
        entry.failures = []
      }
      store.set(key, entry)
    },
    async recordSuccess(key) {
      store.delete(key)
    },
    async reset() {
      store.clear()
    },
  }
}

// ── Magasin PostgreSQL (fenêtre fixe) ───────────────────────────────────────

export function createDatabaseStore(): RateLimitStore {
  return {
    async lockRemaining(key, now) {
      const row = await prisma.loginThrottle.findUnique({ where: { key }, select: { lockedUntil: true } })
      return row?.lockedUntil ? Math.max(0, row.lockedUntil.getTime() - now) : 0
    },
    async recordFailure(key, now, max) {
      const at = new Date(now)
      const windowFloor = new Date(now - WINDOW_MS)
      // Incrément atomique : deux tentatives simultanées ne peuvent pas « perdre » un échec
      const rows = await prisma.$queryRaw<{ failures: number }[]>(Prisma.sql`
        INSERT INTO "LoginThrottle" ("key", "failures", "windowStart", "lockedUntil", "updatedAt")
        VALUES (${key}, 1, ${at}, NULL, ${at})
        ON CONFLICT ("key") DO UPDATE SET
          "failures" = CASE WHEN "LoginThrottle"."windowStart" < ${windowFloor} THEN 1 ELSE "LoginThrottle"."failures" + 1 END,
          "windowStart" = CASE WHEN "LoginThrottle"."windowStart" < ${windowFloor} THEN ${at} ELSE "LoginThrottle"."windowStart" END,
          "updatedAt" = ${at}
        RETURNING "failures"
      `)
      if ((rows[0]?.failures ?? 0) >= max) {
        await prisma.loginThrottle.update({
          where: { key },
          data: { failures: 0, windowStart: at, lockedUntil: new Date(now + LOCK_MS) },
        })
      }
      // Ménage occasionnel des entrées expirées (évite une table qui grossit indéfiniment)
      if (Math.random() < 0.02) {
        await prisma.loginThrottle.deleteMany({
          where: {
            updatedAt: { lt: new Date(now - WINDOW_MS - LOCK_MS) },
            OR: [{ lockedUntil: null }, { lockedUntil: { lt: at } }],
          },
        })
      }
    },
    async recordSuccess(key) {
      await prisma.loginThrottle.deleteMany({ where: { key } })
    },
    async reset() {
      await prisma.loginThrottle.deleteMany({})
    },
  }
}

// ── Sélection du magasin ────────────────────────────────────────────────────

let current: RateLimitStore | undefined

function store(): RateLimitStore {
  current ??= process.env.RATE_LIMIT_STORE === "memory" || process.env.VITEST ? createMemoryStore() : createDatabaseStore()
  return current
}

/** Remplace le magasin (tests). */
export function setRateLimitStore(s: RateLimitStore): void {
  current = s
}

export function lockRemaining(key: string, now = Date.now()): Promise<number> {
  return store().lockRemaining(key, now)
}

export function recordFailure(key: string, now = Date.now(), max = MAX_FAILURES): Promise<void> {
  return store().recordFailure(key, now, max)
}

export function recordSuccess(key: string): Promise<void> {
  return store().recordSuccess(key)
}

/** Réservé aux tests. */
export function resetRateLimit(): Promise<void> {
  return store().reset()
}
