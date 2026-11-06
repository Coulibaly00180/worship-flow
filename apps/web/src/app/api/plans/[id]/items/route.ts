import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManagePlans } from "@/lib/roles"

type Params = { params: Promise<{ id: string }> }

const ItemSchema = z.object({
  order: z.number().int().min(0),
  kind: z.string().min(1).max(30),
  title: z.string().max(200).optional().nullable(),
  content: z.string().max(20_000).optional().nullable(),
  songId: z.string().max(40).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

const BodySchema = z.object({
  items: z.array(ItemSchema).max(100, "100 éléments maximum par plan"),
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
    return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 })
  }

  const plan = await prisma.servicePlan.findUnique({ where: { id: planId } })
  if (!plan || plan.deletedAt) {
    return NextResponse.json({ ok: false, error: "Plan introuvable" }, { status: 404 })
  }

  // Un chant inconnu ou supprimé ferait échouer la clé étrangère (500) : on le refuse proprement
  const songIds = [...new Set(parsed.data.items.map((it) => it.songId).filter((v): v is string => !!v))]
  if (songIds.length) {
    const known = await prisma.song.count({ where: { id: { in: songIds }, deletedAt: null } })
    if (known !== songIds.length) {
      return NextResponse.json({ ok: false, error: "Chant introuvable dans le plan" }, { status: 400 })
    }
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
        notes: it.notes ?? null,
      })),
    })
  })

  return NextResponse.json({ ok: true, data: items })
}
