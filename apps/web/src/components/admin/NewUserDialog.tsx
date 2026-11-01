"use client"

import { useId, useState } from "react"
import { X, AlertCircle } from "lucide-react"
import type { AppRole } from "@/lib/roles"
import { Modal } from "@/components/ui/Modal"

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
  RESPONSABLE_CHANTRE: "Responsable chantre",
  CHANTRE:             "Chantre",
  LECTEUR:             "Lecteur",
}

const ROLE_HELP: Record<AppRole, string> = {
  ADMIN:               "Accès total, y compris la gestion des utilisateurs.",
  RESPONSABLE_CHANTRE: "Gère les chants, les plans et les comptes de rang inférieur.",
  CHANTRE:             "Ajoute et modifie des chants.",
  LECTEUR:             "Consulte les chants et les plans.",
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
  const uid = useId()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<AppRole>(allowedRoles[0] ?? "CHANTRE")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    setError(null)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, username, email, password, role }),
      })
      const json = await res.json()
      if (!json.ok) {
        setError(json.error ?? "La création a échoué. Vérifiez les champs et réessayez.")
        return
      }
      onCreated(json.data)
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau et réessayez.")
    } finally {
      setSaving(false)
    }
  }

  const id = (name: string) => `${uid}-${name}`

  return (
    <Modal open onClose={onClose} titleId={id("title")}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 id={id("title")} className="text-2xl font-bold">Nouvel utilisateur</h2>
        <button type="button" onClick={onClose} className="icon-btn" aria-label="Fermer">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div role="alert" className="flex gap-2.5 items-start rounded-lg p-3 text-sm" style={{ background: "var(--color-error-bg)", color: "var(--color-error)", border: "1px solid var(--color-error)" }}>
            <AlertCircle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor={id("fn")} className="input-label">Prénom</label>
            <input id={id("fn")} type="text" value={firstName} onChange={(e) => handleFirstNameChange(e.target.value)} placeholder="Jean" required autoComplete="off" className="input" />
          </div>
          <div>
            <label htmlFor={id("ln")} className="input-label">Nom</label>
            <input id={id("ln")} type="text" value={lastName} onChange={(e) => handleLastNameChange(e.target.value)} placeholder="Dupont" required autoComplete="off" className="input" />
          </div>
        </div>

        <div>
          <label htmlFor={id("user")} className="input-label">Pseudo</label>
          <input
            id={id("user")}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
            placeholder="jean_dupont"
            required
            minLength={3}
            autoComplete="off"
            autoCapitalize="none"
            aria-describedby={id("user-help")}
            className="input"
          />
          <p id={id("user-help")} className="text-sm mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
            Sert à se connecter : lettres, chiffres, « _ », « . » ou « - ».
          </p>
        </div>

        <div>
          <label htmlFor={id("mail")} className="input-label">Email</label>
          <input id={id("mail")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean@exemple.com" required autoComplete="off" className="input" />
        </div>

        <div>
          <label htmlFor={id("pwd")} className="input-label">Mot de passe provisoire</label>
          <input
            id={id("pwd")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            aria-describedby={id("pwd-help")}
            className="input"
          />
          <p id={id("pwd-help")} className="text-sm mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
            8 caractères minimum. La personne pourra le changer dans son profil.
          </p>
        </div>

        <div>
          <label htmlFor={id("role")} className="input-label">Rôle</label>
          <select id={id("role")} value={role} onChange={(e) => setRole(e.target.value as AppRole)} aria-describedby={id("role-help")} className="input">
            {allowedRoles.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <p id={id("role-help")} className="text-sm mt-1" style={{ color: "var(--color-on-surface-variant)" }}>{ROLE_HELP[role]}</p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">Annuler</button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Création…" : "Créer le compte"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
