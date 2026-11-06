import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManagePlans } from "@/lib/roles"
import { forbidden, isUniqueViolation, jsonError, parseJsonBody, unauthorized } from "@/lib/http"

const DUPLICATE_DATE = "Un plan existe déjà pour cette date"

const CreatePlanSchema = z.object({
  date: z.string().datetime({ message: "Date invalide (ISO 8601 requis)" }),
  title: z.string().trim().max(200).optional(),
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
  if (!session) return unauthorized()
  if (!canManagePlans(session.user.role)) return forbidden()

  const parsed = await parseJsonBody(req, CreatePlanSchema)
  if (!parsed.ok) return parsed.response

  const date = new Date(parsed.data.date)
  const existing = await prisma.servicePlan.findFirst({ where: { date, deletedAt: null }, select: { id: true } })
  if (existing) return jsonError(DUPLICATE_DATE, 409)

  try {
    const plan = await prisma.servicePlan.create({ data: { date, title: parsed.data.title } })
    return NextResponse.json({ ok: true, data: plan }, { status: 201 })
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError(DUPLICATE_DATE, 409)
    throw err
  }
}
