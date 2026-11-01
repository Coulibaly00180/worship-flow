import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SyncPayloadSchema, parseStoredPrefs } from "@/lib/appearanceSync"

/** Réglages d'apparence du compte connecté (synchronisés entre ses appareils). */
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { uiPrefs: true } })
  return NextResponse.json({ ok: true, data: parseStoredPrefs(user?.uiPrefs) })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400 })
  }
  const parsed = SyncPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Réglages invalides" }, { status: 400 })
  }

  // Un horodatage dans le futur (horloge déréglée) ne doit pas verrouiller les autres appareils
  const now = Date.now()
  const updatedAt = Math.min(parsed.data.updatedAt, now + 5 * 60 * 1000)
  const payload = { ...parsed.data, updatedAt }

  // Last-write-wins : on ne remplace jamais une copie plus récente (appareil en retard / requêtes dans le désordre)
  const current = await prisma.user.findUnique({ where: { id: session.user.id }, select: { uiPrefs: true } })
  const existing = parseStoredPrefs(current?.uiPrefs)
  if (existing && existing.updatedAt > updatedAt) {
    return NextResponse.json({ ok: true, data: existing, ignored: true })
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { uiPrefs: JSON.stringify(payload) } })
  return NextResponse.json({ ok: true, data: payload })
}
