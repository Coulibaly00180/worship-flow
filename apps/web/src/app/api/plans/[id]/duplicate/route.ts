import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManagePlans } from "@/lib/roles"
import { isUniqueViolation, jsonError } from "@/lib/http"

const DUPLICATE_DATE = "Un plan existe déjà pour cette date"

type Params = { params: Promise<{ id: string }> }

const DuplicateSchema = z.object({
  date: z.string().datetime({ message: "Date invalide (ISO 8601 requis)" }),
  title: z.string().max(200).optional().nullable(),
})

/** Duplique un plan (et tous ses éléments, notes comprises) vers une nouvelle date. */
export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })
  if (!canManagePlans(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Accès refusé — rôle insuffisant" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400 })
  }
  const parsed = DuplicateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 })
  }

  const { id } = await params
  const source = await prisma.servicePlan.findUnique({
    where: { id },
    include: { items: { orderBy: { order: "asc" } } },
  })
  if (!source || source.deletedAt) {
    return NextResponse.json({ ok: false, error: "Plan introuvable" }, { status: 404 })
  }

  // `date` est unique parmi les plans non supprimés (index unique partiel)
  const date = new Date(parsed.data.date)
  const clash = await prisma.servicePlan.findFirst({ where: { date, deletedAt: null }, select: { id: true } })
  if (clash) return jsonError(DUPLICATE_DATE, 409)

  try {
    const plan = await prisma.servicePlan.create({
      data: {
        date,
        title: parsed.data.title === undefined ? source.title : parsed.data.title,
        items: {
          create: source.items.map((it, index) => ({
            order: index,
            kind: it.kind,
            songId: it.songId,
            title: it.title,
            content: it.content,
            notes: it.notes,
          })),
        },
      },
      select: { id: true, date: true, title: true },
    })
    return NextResponse.json({ ok: true, data: plan }, { status: 201 })
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError(DUPLICATE_DATE, 409)
    throw err
  }
}
