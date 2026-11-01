"use client"

import { useState, useTransition } from "react"
import { Plus, Trash2, UserCheck, UserX } from "lucide-react"
import { toast } from "sonner"
import { NewUserDialog } from "./NewUserDialog"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { canDeleteUser, canChangeUserRole, allowedRolesToAssign } from "@/lib/roles"

type User = {
  id: string
  firstName: string
  lastName: string
  username: string
  name: string
  email: string
  role: string
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  RESPONSABLE_CHANTRE: "Resp. Chantre",
  CHANTRE: "Chantre",
  LECTEUR: "Lecteur",
}

const ROLE_BADGE: Record<string, string> = {
  ADMIN:               "badge badge-progress",
  RESPONSABLE_CHANTRE: "badge badge-mastered",
  CHANTRE:             "badge",
  LECTEUR:             "badge",
}

type Filter = "ALL" | "ADMIN" | "RESPONSABLE_CHANTRE" | "CHANTRE" | "LECTEUR"

export function UserTableClient({
  users: initial,
  currentUserId,
  currentUserRole,
}: {
  users: User[]
  currentUserId: string
  currentUserRole: string
}) {
  const [users, setUsers] = useState(initial)
  const [filter, setFilter] = useState<Filter>("ALL")
  const [showNew, setShowNew] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = filter === "ALL" ? users : users.filter((u) => u.role === filter)

  const canDelete = canDeleteUser(currentUserRole)
  const canToggleActive = canChangeUserRole(currentUserRole)
  const creatableRoles = allowedRolesToAssign(currentUserRole)

  function handleCreated(user: User) {
    setUsers((prev) => [user, ...prev])
    setShowNew(false)
    toast.success(`Utilisateur ${user.name} créé`)
  }

  function toggleActive(user: User) {
    if (!canToggleActive) return
    startTransition(async () => {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: !user.isActive } : u)))
        toast.success(user.isActive ? "Utilisateur désactivé" : "Utilisateur activé")
      } else {
        toast.error("Erreur lors de la mise à jour")
      }
    })
  }

  function deleteUser(user: User) {
    setConfirmDelete(user)
  }

  function doDelete(user: User) {
    setConfirmDelete(null)
    startTransition(async () => {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" })
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== user.id))
        toast.success("Utilisateur supprimé")
      } else {
        toast.error("Erreur lors de la suppression")
      }
    })
  }

  const filters: { value: Filter; label: string }[] = [
    { value: "ALL", label: "Tous" },
    { value: "ADMIN", label: "Admin" },
    { value: "RESPONSABLE_CHANTRE", label: "Resp. Chantre" },
    { value: "CHANTRE", label: "Chantre" },
    { value: "LECTEUR", label: "Lecteur" },
  ]

  return (
    <div className="page-container" style={{ maxWidth: 900 }}>
      <div className="page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Utilisateurs</h1>
          <p className="page-subtitle">Gérez les accès et les rôles de l&apos;équipe.</p>
        </div>
        {creatableRoles.length > 0 && (
          <button type="button" onClick={() => setShowNew(true)} className="btn btn-primary">
            <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
            Nouvel utilisateur
          </button>
        )}
      </div>

      <div className="scroll-x mb-5" style={{ gap: 8 }} role="group" aria-label="Filtrer par rôle">
        {filters.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className="chip"
            data-active={filter === value}
            aria-pressed={filter === value}
          >
            {label}
            <span style={{ opacity: 0.7 }}>
              {value === "ALL" ? users.length : users.filter((u) => u.role === value).length}
            </span>
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-3">
        {filtered.map((user) => {
          const initials = user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
          const isSelf = user.id === currentUserId

          return (
            <li key={user.id} className="card flex flex-wrap items-center gap-x-4 gap-y-3" style={{ padding: "14px 16px", opacity: user.isActive ? 1 : 0.75 }}>
              <div
                className="grid place-items-center rounded-full font-bold shrink-0"
                style={{ width: 44, height: 44, background: "var(--color-primary-container)", color: "var(--color-on-primary-container)" }}
                aria-hidden="true"
              >
                {initials}
              </div>

              <div className="flex-1 min-w-[160px]">
                <p className="font-bold text-lg leading-tight" style={{ color: "var(--color-on-surface)" }}>
                  {user.name}
                  {isSelf && <span className="ml-2 text-sm font-semibold" style={{ color: "var(--color-on-surface-variant)" }}>(vous)</span>}
                </p>
                <p className="text-sm break-all" style={{ color: "var(--color-on-surface-variant)" }}>@{user.username} · {user.email}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={ROLE_BADGE[user.role] ?? "badge"}>{ROLE_LABELS[user.role] ?? user.role}</span>
                  <span
                    className="inline-flex items-center gap-1.5 text-sm font-semibold"
                    style={{ color: user.isActive ? "var(--color-mastered)" : "var(--color-on-surface-variant)" }}
                  >
                    {user.isActive ? <UserCheck size={15} aria-hidden="true" /> : <UserX size={15} aria-hidden="true" />}
                    {user.isActive ? "Actif" : "Désactivé"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 ml-auto">
                {canToggleActive && (
                  <button
                    type="button"
                    onClick={() => toggleActive(user)}
                    disabled={isPending || isSelf}
                    className="icon-btn"
                    aria-label={`${user.isActive ? "Désactiver" : "Activer"} ${user.name}`}
                    title={isSelf ? "Vous ne pouvez pas modifier votre propre compte ici" : user.isActive ? "Désactiver" : "Activer"}
                  >
                    {user.isActive ? <UserX size={19} aria-hidden="true" /> : <UserCheck size={19} aria-hidden="true" />}
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => deleteUser(user)}
                    disabled={isPending || isSelf}
                    className="icon-btn icon-btn-danger"
                    aria-label={`Supprimer ${user.name}`}
                    title="Supprimer"
                  >
                    <Trash2 size={19} aria-hidden="true" />
                  </button>
                )}
              </div>
            </li>
          )
        })}

        {filtered.length === 0 && (
          <li className="text-center py-10" style={{ color: "var(--color-on-surface-variant)" }}>
            Aucun utilisateur dans cette catégorie.
          </li>
        )}
      </ul>

      <p className="mt-4 text-sm" style={{ color: "var(--color-on-surface-variant)" }} aria-live="polite">
        {filtered.length} sur {users.length} utilisateur{users.length !== 1 ? "s" : ""}
      </p>

      {showNew && (
        <NewUserDialog
          onClose={() => setShowNew(false)}
          onCreated={handleCreated}
          allowedRoles={creatableRoles}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Supprimer l'utilisateur"
        description={confirmDelete ? `Supprimer ${confirmDelete.name} (@${confirmDelete.username}) ? Cette action est irréversible.` : ""}
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
