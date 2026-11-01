import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManagePlans } from "@/lib/roles"

type Params = { params: Promise<{ id: string }> }

const ItemSchema = z.object({
  order: z.number().int().min(0),
  kind: z.string().min(1),
  title: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  songId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  refId: z.string().optional().nullable(),
  refSubId: z.string().optional().nullable(),
  mediaPath: z.string().optional().nullable(),
  secondaryContent: z.string().optional().nullable(),
  backgroundConfig: z.string().optional().nullable(),
})

const BodySchema = z.object({
  items: z.array(ItemSchema),
})

export async function PUT(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })
  if (!canManagePlans(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Accès refusé — rôle insuffisant" }, { status: 403 })
  }

  const { id: planId } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const plan = await prisma.servicePlan.findUnique({ where: { id: planId } })
  if (!plan || plan.deletedAt) {
    return NextResponse.json({ ok: false, error: "Plan introuvable" }, { status: 404 })
  }

  const items = await prisma.$transaction(async (tx) => {
    await tx.serviceItem.deleteMany({ where: { planId } })
    return tx.serviceItem.createMany({
      data: parsed.data.items.map((it, index) => ({
        planId,
        order: index,
        kind: it.kind,
        title: it.title ?? null,
        content: it.content ?? null,
        songId: it.songId ?? null,
        refId: it.refId ?? it.songId ?? null,
        refSubId: it.refSubId ?? null,
        notes: it.notes ?? null,
        mediaPath: it.mediaPath ?? null,
        secondaryContent: it.secondaryContent ?? null,
        backgroundConfig: it.backgroundConfig ?? null,
      })),
    })
  })

  return NextResponse.json({ ok: true, data: items })
}
