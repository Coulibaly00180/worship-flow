import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canChangeUserRole, canDeleteUser, canAccessUserAdmin, canManageTarget } from "@/lib/roles"
import { isUniqueViolation, jsonError } from "@/lib/http"

type Params = { params: Promise<{ id: string }> }

const UpdateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName:  z.string().trim().min(1).max(100).optional(),
  username:  z.string().min(3).max(40).regex(/^[a-z0-9_.-]+$/i).optional(),
  name:      z.string().trim().min(1).max(200).optional(),
  email:     z.string().trim().toLowerCase().email().optional(),
  role:      z.enum(["ADMIN", "RESPONSABLE_CHANTRE", "CHANTRE", "LECTEUR"]).optional(),
  isActive:  z.boolean().optional(),
  password:  z.string().min(8, "Mot de passe minimum 8 caractères").max(200).optional(),
  // Obligatoire pour changer SON PROPRE mot de passe (une session volée ne suffit pas à prendre le compte)
  currentPassword: z.string().max(200).optional(),
})

/** Reste-t-il au moins un autre administrateur actif que `exceptId` ? */
async function hasOtherActiveAdmin(exceptId: string): Promise<boolean> {
  const n = await prisma.user.count({ where: { role: "ADMIN", isActive: true, NOT: { id: exceptId } } })
  return n > 0
}

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

  const target = await prisma.user.findUnique({
    where: { id },
    select: { role: true, isActive: true, passwordHash: true, firstName: true, lastName: true },
  })
  if (!target) return jsonError("Utilisateur introuvable", 404)

  // Un gestionnaire ne peut pas modifier un compte de rang supérieur ou égal au sien
  if (!isSelf && !canManageTarget(session.user.role, target.role)) {
    return jsonError("Accès refusé", 403)
  }


  const { password, currentPassword, role, isActive, username, firstName, lastName, ...rest } = parsed.data

  const data: Record<string, unknown> = { ...rest }
  let bumpSession = false

  // email / name libre : soi-même ou ADMIN (évite le détournement d'un compte par un gestionnaire)
  if ((rest.email !== undefined || rest.name !== undefined) && !isSelf && !isAdmin) {
    return NextResponse.json({ ok: false, error: "Accès refusé" }, { status: 403 })
  }

  if (rest.email !== undefined) {
    const taken = await prisma.user.findFirst({
      where: { email: { equals: rest.email, mode: "insensitive" }, NOT: { id } },
      select: { id: true },
    })
    if (taken) return jsonError("Cet email est déjà utilisé", 409)
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
    data.name = `${firstName ?? target.firstName} ${lastName ?? target.lastName}`.trim()
  }

  // Rôle : ADMIN seulement
  if (role !== undefined) {
    if (!canChangeUserRole(session.user.role)) {
      return NextResponse.json({ ok: false, error: "Seul un administrateur peut modifier les rôles" }, { status: 403 })
    }
    // Ne jamais laisser l'application sans administrateur
    if (target.role === "ADMIN" && role !== "ADMIN" && !(await hasOtherActiveAdmin(id))) {
      return jsonError("Impossible : c'est le dernier administrateur actif", 409)
    }
    data.role = role
  }

  // isActive : ADMIN seulement
  if (isActive !== undefined) {
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Seul un administrateur peut activer/désactiver un compte" }, { status: 403 })
    }
    if (isSelf && !isActive) return jsonError("Vous ne pouvez pas désactiver votre propre compte", 400)
    if (!isActive && target.role === "ADMIN" && !(await hasOtherActiveAdmin(id))) {
      return jsonError("Impossible : c'est le dernier administrateur actif", 409)
    }
    data.isActive = isActive
    if (!isActive) bumpSession = true
  }

  // Mot de passe : soi-même ou ADMIN uniquement (jamais un gestionnaire sur un autre compte)
  if (password && !isSelf && !isAdmin) {
    return NextResponse.json({ ok: false, error: "Seul un administrateur peut réinitialiser le mot de passe d'un autre utilisateur" }, { status: 403 })
  }
  if (password) {
    // Sur son propre compte (admin compris), le mot de passe actuel est exigé
    if (isSelf) {
      const valid = !!currentPassword && (await bcrypt.compare(currentPassword, target.passwordHash))
      if (!valid) return jsonError("Mot de passe actuel incorrect", 403, "INVALID_CURRENT_PASSWORD")
    }
    data.passwordHash = await bcrypt.hash(password, 12)
    // Toutes les sessions ouvertes (autres appareils, session volée) sont invalidées
    bumpSession = true
  }
  if (bumpSession) data.sessionVersion = { increment: 1 }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, firstName: true, lastName: true, username: true, name: true, email: true, role: true, isActive: true, updatedAt: true },
    })
    return NextResponse.json({ ok: true, data: user, ...(bumpSession && isSelf ? { reauth: true } : {}) })
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError("Cet email ou ce pseudo est déjà utilisé", 409)
    throw err
  }
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

  const { count } = await prisma.user.deleteMany({ where: { id } })
  if (count === 0) return jsonError("Utilisateur introuvable", 404)

  return NextResponse.json({ ok: true, data: { id } })
}
