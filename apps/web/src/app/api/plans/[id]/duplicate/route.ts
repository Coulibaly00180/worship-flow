import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManagePlans } from "@/lib/roles"

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

  // `date` est unique en base, y compris pour les plans supprimés (soft-delete)
  const date = new Date(parsed.data.date)
  const clash = await prisma.servicePlan.findUnique({ where: { date }, select: { id: true } })
  if (clash) {
    return NextResponse.json({ ok: false, error: "Un plan existe déjà pour cette date" }, { status: 409 })
  }

  const plan = await prisma.servicePlan.create({
    data: {
      date,
      title: parsed.data.title === undefined ? source.title : parsed.data.title,
      backgroundConfig: source.backgroundConfig,
      items: {
        create: source.items.map((it, index) => ({
          order: index,
          kind: it.kind,
          refId: it.refId,
          refSubId: it.refSubId,
          songId: it.songId,
          title: it.title,
          content: it.content,
          notes: it.notes,
          mediaPath: it.mediaPath,
          secondaryContent: it.secondaryContent,
          backgroundConfig: it.backgroundConfig,
        })),
      },
    },
    select: { id: true, date: true, title: true },
  })

  return NextResponse.json({ ok: true, data: plan }, { status: 201 })
}
