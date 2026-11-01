import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManagePlans } from "@/lib/roles"

const CreatePlanSchema = z.object({
  date: z.string().datetime({ message: "Date invalide (ISO 8601 requis)" }),
  title: z.string().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })

  const plans = await prisma.servicePlan.findMany({
    where: { deletedAt: null },
    orderBy: { date: "desc" },
    include: { _count: { select: { items: true } } },
  })

  return NextResponse.json({ ok: true, data: plans })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })
  if (!canManagePlans(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Accès refusé — rôle insuffisant" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = CreatePlanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 })
  }

  const existing = await prisma.servicePlan.findFirst({
    where: { date: new Date(parsed.data.date), deletedAt: null },
  })
  if (existing) {
    return NextResponse.json({ ok: false, error: "Un plan existe déjà pour cette date" }, { status: 409 })
  }

  const plan = await prisma.servicePlan.create({
    data: { date: new Date(parsed.data.date), title: parsed.data.title },
  })

  return NextResponse.json({ ok: true, data: plan }, { status: 201 })
}
