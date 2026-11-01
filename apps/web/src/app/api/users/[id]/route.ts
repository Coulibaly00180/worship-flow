import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canChangeUserRole, canDeleteUser, canAccessUserAdmin, canManageTarget } from "@/lib/roles"

type Params = { params: Promise<{ id: string }> }

const UpdateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName:  z.string().min(1).optional(),
  username:  z.string().min(3).regex(/^[a-z0-9_.-]+$/i).optional(),
  name:      z.string().min(1).optional(),
  email:     z.string().email().optional(),
  role:      z.enum(["ADMIN", "RESPONSABLE_CHANTRE", "CHANTRE", "LECTEUR"]).optional(),
  isActive:  z.boolean().optional(),
  password:  z.string().min(8).optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })

  const { id } = await params
  const isSelf = session.user.id === id
  const isAdmin = session.user.role === "ADMIN"
  const isManager = canAccessUserAdmin(session.user.role)

  // Seul soi-même ou un gestionnaire peut modifier un utilisateur
  if (!isSelf && !isManager) {
    return NextResponse.json({ ok: false, error: "Accès refusé" }, { status: 403 })
  }

  // Un gestionnaire ne peut pas modifier un compte de rang supérieur ou égal au sien
  if (!isSelf) {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
    if (!target) return NextResponse.json({ ok: false, error: "Utilisateur introuvable" }, { status: 404 })
    if (!canManageTarget(session.user.role, target.role)) {
      return NextResponse.json({ ok: false, error: "Accès refusé" }, { status: 403 })
    }
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400 })
  }
  const parsed = UpdateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { password, role, isActive, username, firstName, lastName, ...rest } = parsed.data

  const data: Record<string, unknown> = { ...rest }

  // email / name libre : soi-même ou ADMIN (évite le détournement d'un compte par un gestionnaire)
  if ((rest.email !== undefined || rest.name !== undefined) && !isSelf && !isAdmin) {
    return NextResponse.json({ ok: false, error: "Accès refusé" }, { status: 403 })
  }

  // username : seulement soi-même
  if (username !== undefined) {
    if (!isSelf) return NextResponse.json({ ok: false, error: "Vous ne pouvez modifier que votre propre pseudo" }, { status: 403 })
    const taken = await prisma.user.findFirst({ where: { username, NOT: { id } } })
    if (taken) return NextResponse.json({ ok: false, error: "Ce pseudo est déjà pris" }, { status: 409 })
    data.username = username
  }

  // firstName/lastName : soi-même ou gestionnaire
  if (firstName !== undefined || lastName !== undefined) {
    if (!isSelf && !isManager) return NextResponse.json({ ok: false, error: "Accès refusé" }, { status: 403 })
    if (firstName !== undefined) data.firstName = firstName
    if (lastName !== undefined) data.lastName = lastName
    // Resynchroniser name
    const target = await prisma.user.findUniqueOrThrow({ where: { id }, select: { firstName: true, lastName: true } })
    data.name = `${firstName ?? target.firstName} ${lastName ?? target.lastName}`.trim()
  }

  // Rôle : ADMIN seulement
  if (role !== undefined) {
    if (!canChangeUserRole(session.user.role)) {
      return NextResponse.json({ ok: false, error: "Seul un administrateur peut modifier les rôles" }, { status: 403 })
    }
    data.role = role
  }

  // isActive : ADMIN seulement
  if (isActive !== undefined) {
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Seul un administrateur peut activer/désactiver un compte" }, { status: 403 })
    }
    data.isActive = isActive
  }

  // Mot de passe : soi-même ou ADMIN uniquement (jamais un gestionnaire sur un autre compte)
  if (password && !isSelf && !isAdmin) {
    return NextResponse.json({ ok: false, error: "Seul un administrateur peut réinitialiser le mot de passe d'un autre utilisateur" }, { status: 403 })
  }
  if (password) data.passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, firstName: true, lastName: true, username: true, name: true, email: true, role: true, isActive: true, updatedAt: true },
  })

  return NextResponse.json({ ok: true, data: user })
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })
  if (!canDeleteUser(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Seul un administrateur peut supprimer des utilisateurs" }, { status: 403 })
  }

  const { id } = await params

  if (session.user.id === id) {
    return NextResponse.json({ ok: false, error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 400 })
  }

  await prisma.user.delete({ where: { id } })

  return NextResponse.json({ ok: true, data: { id } })
}
