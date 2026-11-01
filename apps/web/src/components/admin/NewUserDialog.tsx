"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { toast } from "sonner"
import type { AppRole } from "@/lib/roles"

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

const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN:               "Administrateur",
  RESPONSABLE_CHANTRE: "Responsable Chantre",
  CHANTRE:             "Chantre",
  LECTEUR:             "Lecteur",
}

export function NewUserDialog({
  onClose,
  onCreated,
  allowedRoles,
}: {
  onClose: () => void
  onCreated: (user: User) => void
  allowedRoles: AppRole[]
}) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<AppRole>(allowedRoles[0] ?? "CHANTRE")
  const [saving, setSaving] = useState(false)

  // Auto-générer un pseudo depuis prénom+nom
  function suggestUsername(fn: string, ln: string) {
    return (fn + (ln ? "_" + ln : "")).toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 20)
  }

  function handleFirstNameChange(v: string) {
    setFirstName(v)
    if (!username || username === suggestUsername(firstName, lastName)) {
      setUsername(suggestUsername(v, lastName))
    }
  }

  function handleLastNameChange(v: string) {
    setLastName(v)
    if (!username || username === suggestUsername(firstName, lastName)) {
      setUsername(suggestUsername(firstName, v))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, username, email, password, role }),
      })
      const json = await res.json()
      if (!json.ok) {
        toast.error(json.error ?? "Erreur lors de la création")
        return
      }
      onCreated(json.data)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "var(--color-scrim)" }}>
      <div className="card w-full max-w-md mx-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-outline-variant)" }}>
        <div className="flex items-center justify-between pb-4 mb-4" style={{ borderBottom: "1px solid var(--color-outline-variant)" }}>
          <h2 className="text-base font-bold" style={{ color: "var(--color-primary)" }}>Nouvel utilisateur</h2>
          <button type="button" onClick={onClose} className="btn btn-ghost" style={{ padding: "4px" }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Prénom</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => handleFirstNameChange(e.target.value)}
                placeholder="Jean"
                required
                className="input"
              />
            </div>
            <div>
              <label className="input-label">Nom</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => handleLastNameChange(e.target.value)}
                placeholder="Dupont"
                required
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="input-label">Pseudo <span style={{ color: "var(--color-on-surface-variant)", fontWeight: 400 }}>(pour la connexion)</span></label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
              placeholder="jean_dupont"
              required
              minLength={3}
              className="input"
            />
          </div>

          <div>
            <label className="input-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jean@exemple.com"
              required
              className="input"
            />
          </div>

          <div>
            <label className="input-label">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 caractères"
              required
              minLength={8}
              className="input"
            />
          </div>

          <div>
            <label className="input-label">Rôle</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              className="input"
            >
              {allowedRoles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
              {saving ? "Création…" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
