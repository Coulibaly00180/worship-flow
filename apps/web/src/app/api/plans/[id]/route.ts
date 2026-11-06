import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManagePlans } from "@/lib/roles"
import { forbidden, isUniqueViolation, jsonError, parseJsonBody, unauthorized } from "@/lib/http"

const DUPLICATE_DATE = "Un plan existe déjà pour cette date"

type Params = { params: Promise<{ id: string }> }

const UpdatePlanSchema = z.object({
  date: z.string().datetime().optional(),
  title: z.string().trim().max(200).optional().nullable(),
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
  if (!session) return unauthorized()
  if (!canManagePlans(session.user.role)) return forbidden()

  const { id } = await params
  const parsed = await parseJsonBody(req, UpdatePlanSchema)
  if (!parsed.ok) return parsed.response

  const plan = await prisma.servicePlan.findUnique({ where: { id } })
  if (!plan || plan.deletedAt) return jsonError("Plan introuvable", 404)

  const date = parsed.data.date ? new Date(parsed.data.date) : undefined
  if (date && date.getTime() !== plan.date.getTime()) {
    const clash = await prisma.servicePlan.findFirst({
      where: { date, deletedAt: null, NOT: { id } },
      select: { id: true },
    })
    if (clash) return jsonError(DUPLICATE_DATE, 409)
  }

  try {
    const updated = await prisma.servicePlan.update({
      where: { id },
      data: {
        ...(date ? { date } : {}),
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      },
    })
    return NextResponse.json({ ok: true, data: updated })
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError(DUPLICATE_DATE, 409)
    throw err
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!canManagePlans(session.user.role)) return forbidden()

  const { id } = await params
  const { count } = await prisma.servicePlan.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  })
  if (count === 0) return jsonError("Plan introuvable", 404)

  return NextResponse.json({ ok: true, data: { id } })
}
