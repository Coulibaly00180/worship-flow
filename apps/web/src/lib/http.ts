import { NextResponse } from "next/server"
import type { z } from "zod"

/** Réponse d'erreur au format commun de l'API : `{ ok: false, error, code? }`. */
export function jsonError(error: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, error, ...(code ? { code } : {}) }, { status })
}

export const unauthorized = () => jsonError("Non authentifié", 401)
export const forbidden = (error = "Accès refusé — rôle insuffisant") => jsonError(error, 403)

type Parsed<T> = { ok: true; data: T } | { ok: false; response: NextResponse }

/**
 * Lit le corps JSON et le valide avec `schema`.
 * Un corps absent / illisible donne 400 (et non une erreur 500 non gérée).
 */
export async function parseJsonBody<S extends z.ZodType>(req: Request, schema: S): Promise<Parsed<z.infer<S>>> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return { ok: false, response: jsonError("JSON invalide", 400) }
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return { ok: false, response: jsonError(parsed.error.issues[0]?.message ?? "Données invalides", 400) }
  }
  return { ok: true, data: parsed.data }
}

/** Erreur Prisma « contrainte d'unicité violée » (P2002) — concurrence entre deux requêtes, par ex. */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002"
}
