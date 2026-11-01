/**
 * Hiérarchie des rôles par niveau numérique.
 * Plus le niveau est élevé, plus le rôle est privilégié.
 * Une permission accordée à un niveau s'applique à tous les niveaux supérieurs.
 *
 * ADMIN               100 — accès total
 * RESPONSABLE_CHANTRE  70 — gère chants + plans + peut créer CHANTRE/LECTEUR
 * CHANTRE              40 — crée et modifie des chants
 * LECTEUR              10 — lecture seule
 */

export type AppRole = "ADMIN" | "RESPONSABLE_CHANTRE" | "CHANTRE" | "LECTEUR"

const ROLE_LEVEL: Record<AppRole, number> = {
  ADMIN:               100,
  RESPONSABLE_CHANTRE:  70,
  CHANTRE:              40,
  LECTEUR:              10,
}

function level(role: string): number {
  return ROLE_LEVEL[role as AppRole] ?? 0
}

function atLeast(role: string, min: AppRole): boolean {
  return level(role) >= level(min)
}

// ── Chants ───────────────────────────────────────────────────────────────────

/** Peut créer ou modifier un chant */
export function canEditSongs(role: string): boolean {
  return atLeast(role, "CHANTRE")
}

/** Peut supprimer un chant (soft-delete) */
export function canDeleteSongs(role: string): boolean {
  return atLeast(role, "RESPONSABLE_CHANTRE")
}

/** Peut importer des chants en masse */
export function canImportSongs(role: string): boolean {
  return atLeast(role, "CHANTRE")
}

// ── Plans ────────────────────────────────────────────────────────────────────

/** Peut créer, modifier ou supprimer un plan de service */
export function canManagePlans(role: string): boolean {
  return atLeast(role, "RESPONSABLE_CHANTRE")
}

// ── Utilisateurs ─────────────────────────────────────────────────────────────

/** Peut accéder à la page de gestion des utilisateurs */
export function canAccessUserAdmin(role: string): boolean {
  return atLeast(role, "RESPONSABLE_CHANTRE")
}

/** Peut créer un nouvel utilisateur */
export function canCreateUser(role: string): boolean {
  return atLeast(role, "RESPONSABLE_CHANTRE")
}

/**
 * Rôles qu'un gestionnaire peut attribuer.
 * Règle : on ne peut attribuer que des rôles strictement inférieurs au sien.
 * Seul ADMIN peut attribuer ADMIN.
 */
export function allowedRolesToAssign(creatorRole: string): AppRole[] {
  const creatorLevel = level(creatorRole)
  if (creatorLevel === 0) return []
  // ADMIN peut s'attribuer à lui-même et aux autres
  const allRoles: AppRole[] = ["ADMIN", "RESPONSABLE_CHANTRE", "CHANTRE", "LECTEUR"]
  if (creatorRole === "ADMIN") return allRoles
  // Les autres ne peuvent attribuer que des rôles strictement inférieurs
  return allRoles.filter((r) => level(r) < creatorLevel)
}

/** Peut changer le rôle d'un utilisateur ou activer/désactiver un compte */
export function canChangeUserRole(role: string): boolean {
  return atLeast(role, "ADMIN")
}

/** Peut supprimer un utilisateur */
export function canDeleteUser(role: string): boolean {
  return atLeast(role, "ADMIN")
}

/**
 * Un utilisateur ne peut agir sur un autre compte que si son rang est
 * strictement supérieur, sauf ADMIN qui peut agir sur tous les comptes.
 */
export function canManageTarget(actorRole: string, targetRole: string): boolean {
  if (actorRole === "ADMIN") return true
  return level(actorRole) > level(targetRole)
}
