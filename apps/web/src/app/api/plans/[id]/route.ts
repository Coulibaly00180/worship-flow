import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManagePlans } from "@/lib/roles"

type Params = { params: Promise<{ id: string }> }

const UpdatePlanSchema = z.object({
  date: z.string().datetime().optional(),
  title: z.string().optional().nullable(),
})

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })

  const { id } = await params
  const plan = await prisma.servicePlan.findUnique({
    where: { id },
    include: { items: { orderBy: { order: "asc" }, include: { song: { select: { id: true, title: true } } } } },
  })

  if (!plan || plan.deletedAt) {
    return NextResponse.json({ ok: false, error: "Plan introuvable" }, { status: 404 })
  }

  return NextResponse.json({ ok: true, data: plan })
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })
  if (!canManagePlans(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Accès refusé — rôle insuffisant" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = UpdatePlanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 })
  }

  const plan = await prisma.servicePlan.findUnique({ where: { id } })
  if (!plan || plan.deletedAt) {
    return NextResponse.json({ ok: false, error: "Plan introuvable" }, { status: 404 })
  }

  const updated = await prisma.servicePlan.update({
    where: { id },
    data: {
      ...(parsed.data.date ? { date: new Date(parsed.data.date) } : {}),
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
    },
  })

  return NextResponse.json({ ok: true, data: updated })
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })
  if (!canManagePlans(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Accès refusé — rôle insuffisant" }, { status: 403 })
  }

  const { id } = await params
  await prisma.servicePlan.update({ where: { id }, data: { deletedAt: new Date() } })

  return NextResponse.json({ ok: true, data: { id } })
}
