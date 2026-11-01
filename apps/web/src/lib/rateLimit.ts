/**
 * Limiteur de tentatives de connexion en mémoire (fenêtre glissante).
 *
 * Limite : l'état est local à l'instance. Sur un déploiement serverless (Vercel) ou
 * multi-réplicas, chaque instance compte séparément ; cela freine le brute-force sans le
 * bloquer totalement. Pour une garantie stricte, brancher un store partagé (Redis/Postgres).
 */

type Entry = { failures: number[]; lockedUntil: number }

const store = new Map<string, Entry>()

export const MAX_FAILURES = 5
export const WINDOW_MS = 15 * 60 * 1000
export const LOCK_MS = 15 * 60 * 1000
const MAX_KEYS = 10_000

function prune(now: number) {
  if (store.size < MAX_KEYS) return
  for (const [key, entry] of store) {
    if (entry.lockedUntil < now && entry.failures.every((t) => now - t > WINDOW_MS)) store.delete(key)
  }
  // Garde-fou mémoire : si toujours plein, on repart de zéro plutôt que de grossir sans limite
  if (store.size >= MAX_KEYS) store.clear()
}

/** Retourne les ms restantes de blocage (0 = autorisé). */
export function lockRemaining(key: string, now = Date.now()): number {
  const entry = store.get(key)
  if (!entry) return 0
  return Math.max(0, entry.lockedUntil - now)
}

export function recordFailure(key: string, now = Date.now(), max = MAX_FAILURES): void {
  prune(now)
  const entry = store.get(key) ?? { failures: [], lockedUntil: 0 }
  entry.failures = entry.failures.filter((t) => now - t <= WINDOW_MS)
  entry.failures.push(now)
  if (entry.failures.length >= max) {
    entry.lockedUntil = now + LOCK_MS
    entry.failures = []
  }
  store.set(key, entry)
}

export function recordSuccess(key: string): void {
  store.delete(key)
}

/** Réservé aux tests. */
export function resetRateLimit(): void {
  store.clear()
}
