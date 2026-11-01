"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { Heart, TrendingUp, User, LogOut, Users, ChevronRight } from "lucide-react"
import { AppearanceSettings } from "@/components/profile/AppearanceSettings"
import { clearOfflineCaches } from "@/lib/offline"
import { canAccessUserAdmin } from "@/lib/roles"

type ProfileUser = {
  id: string
  firstName: string
  lastName: string
  username: string
  name: string
  email: string
  role: string
  createdAt: Date
  lastLoginAt: Date | null
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN:               "Administrateur",
  RESPONSABLE_CHANTRE: "Responsable Chantre",
  CHANTRE:             "Chantre",
  LECTEUR:             "Lecteur",
}

export function ProfileClient({
  user,
  favCount,
  masteredCount,
}: {
  user: ProfileUser
  favCount: number
  masteredCount: number
}) {
  const [username, setUsername] = useState(user.username)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingInfo, setSavingInfo] = useState(false)
  const [isPendingPwd, startSavingPwd] = useTransition()

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() || "?"

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault()
    setSavingInfo(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })
      const json = await res.json()
      if (json.ok) toast.success("Pseudo mis à jour")
      else toast.error(json.error ?? "Erreur")
    } finally {
      setSavingInfo(false)
    }
  }

  function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas")
      return
    }
    startSavingPwd(async () => {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      })
      const json = await res.json()
      if (json.ok) {
        toast.success("Mot de passe mis à jour")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        toast.error(json.error ?? "Erreur")
      }
    })
  }

  return (
    <div className="page-container max-w-3xl">
      <h1 className="page-title mb-6">Mon profil</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche */}
        <div className="flex flex-col gap-4">
          <div className="card flex flex-col items-center text-center">
            <div
              className="w-20 h-20 rounded-full text-2xl font-bold flex items-center justify-center mb-3"
              style={{ background: "var(--color-primary-container)", color: "var(--color-on-primary-container)" }}
            >
              {initials}
            </div>
            <p className="font-bold" style={{ color: "var(--color-primary)" }}>{user.name}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-on-surface-variant)" }}>@{user.username}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-on-surface-variant)" }}>{user.email}</p>
            <span
              className="mt-2 px-2.5 py-1 text-xs font-semibold rounded-full"
              style={{ background: "var(--color-surface-high)", color: "var(--color-on-surface-variant)" }}
            >
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="card text-center" style={{ padding: "16px" }}>
              <Heart size={16} className="mx-auto mb-1" style={{ color: "var(--color-tertiary)" }} />
              <p className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{favCount}</p>
              <p className="text-xs" style={{ color: "var(--color-on-surface-variant)" }}>Favoris</p>
            </div>
            <div className="card text-center" style={{ padding: "16px" }}>
              <TrendingUp size={16} className="mx-auto mb-1" style={{ color: "var(--color-mastered)" }} />
              <p className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{masteredCount}</p>
              <p className="text-xs" style={{ color: "var(--color-on-surface-variant)" }}>Maîtrisés</p>
            </div>
          </div>

          <AppearanceSettings />

          {canAccessUserAdmin(user.role) && (
            <Link href="/app/admin/users" className="card flex items-center gap-3" style={{ textDecoration: "none", minHeight: 64 }}>
              <Users size={20} style={{ color: "var(--color-primary)" }} aria-hidden="true" />
              <span className="flex-1 font-bold" style={{ color: "var(--color-on-surface)" }}>Gérer les utilisateurs</span>
              <ChevronRight size={18} style={{ color: "var(--color-on-surface-variant)" }} aria-hidden="true" />
            </Link>
          )}

          <button
            type="button"
            className="btn btn-secondary w-full"
            onClick={async () => { await clearOfflineCaches(); await signOut({ callbackUrl: "/login" }) }}
          >
            <LogOut size={18} aria-hidden="true" />
            Se déconnecter
          </button>
        </div>

        {/* Colonne droite */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <form onSubmit={saveInfo} className="card">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: "var(--color-primary)" }}>
              <User size={15} />
              Informations
            </h2>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Prénom</label>
                  <input
                    value={user.firstName}
                    disabled
                    className="input"
                    style={{ opacity: 0.5, cursor: "not-allowed" }}
                  />
                </div>
                <div>
                  <label className="input-label">Nom</label>
                  <input
                    value={user.lastName}
                    disabled
                    className="input"
                    style={{ opacity: 0.5, cursor: "not-allowed" }}
                  />
                </div>
              </div>
              <div>
                <label className="input-label">
                  Pseudo
                  <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--color-on-surface-variant)" }}>
                    — utilisé pour la connexion
                  </span>
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                  minLength={3}
                  required
                  className="input"
                  placeholder="mon_pseudo"
                />
              </div>
              <div>
                <label className="input-label">Email</label>
                <input
                  value={user.email}
                  disabled
                  className="input"
                  style={{ opacity: 0.5, cursor: "not-allowed" }}
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button type="submit" disabled={savingInfo} className="btn btn-primary btn-sm">
                {savingInfo ? "Sauvegarde…" : "Enregistrer le pseudo"}
              </button>
            </div>
          </form>

          <form onSubmit={savePassword} className="card">
            <h2 className="text-sm font-bold mb-4" style={{ color: "var(--color-primary)" }}>Sécurité</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="input-label">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  required
                  className="input"
                />
              </div>
              <div>
                <label className="input-label">Confirmer le mot de passe</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input"
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button type="submit" disabled={isPendingPwd} className="btn btn-primary btn-sm">
                {isPendingPwd ? "Mise à jour…" : "Mettre à jour le mot de passe"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
