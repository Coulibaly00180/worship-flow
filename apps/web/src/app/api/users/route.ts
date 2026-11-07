import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateUserSchema } from "@/lib/validations"
import { canAccessUserAdmin, canCreateUser, allowedRolesToAssign } from "@/lib/roles"
import { isUniqueViolation, jsonError, parseJsonBody } from "@/lib/http"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })
  if (!canAccessUserAdmin(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Accès refusé" }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ ok: true, data: users })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })
  if (!canCreateUser(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Accès refusé" }, { status: 403 })
  }

  const parsed = await parseJsonBody(req, CreateUserSchema)
  if (!parsed.ok) return parsed.response

  // Vérifier que le créateur a le droit d'attribuer ce rôle
  const allowed = allowedRolesToAssign(session.user.role)
  if (!allowed.includes(parsed.data.role)) {
    return NextResponse.json(
      { ok: false, error: `Vous ne pouvez pas attribuer le rôle "${parsed.data.role}"` },
      { status: 403 }
    )
  }

  const [byEmail, byUsername] = await Promise.all([
    prisma.user.findFirst({ where: { email: { equals: parsed.data.email, mode: "insensitive" } }, select: { id: true } }),
    prisma.user.findUnique({ where: { username: parsed.data.username }, select: { id: true } }),
  ])
  if (byEmail) return NextResponse.json({ ok: false, error: "Cet email est déjà utilisé" }, { status: 409 })
  if (byUsername) return NextResponse.json({ ok: false, error: "Ce pseudo est déjà pris" }, { status: 409 })

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const fullName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim()
  let user
  try {
    user = await prisma.user.create({
      data: {
        firstName: parsed.data.firstName,
        lastName:  parsed.data.lastName,
        username:  parsed.data.username,
        name:      fullName,
        email:     parsed.data.email,
        passwordHash,
        role:      parsed.data.role,
      },
      select: { id: true, firstName: true, lastName: true, username: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    })
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError("Cet email ou ce pseudo est déjà utilisé", 409)
    throw err
  }

  return NextResponse.json({ ok: true, data: user }, { status: 201 })
}
