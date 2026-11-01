"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AtSign, Lock, ArrowRight, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react"

export function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const result = await signIn("credentials", { email: login, password, redirect: false })
      if (result?.error) {
        setError("Identifiant ou mot de passe incorrect. Après plusieurs essais, la connexion est suspendue 15 minutes.")
        return
      }
      router.push("/app")
      router.refresh()
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau et réessayez.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-5" style={{ padding: "28px" }} noValidate>
      {error && (
        <div
          role="alert"
          className="flex gap-2.5 items-start rounded-lg p-3 text-sm"
          style={{ background: "var(--color-error-bg)", color: "var(--color-error)", border: "1px solid var(--color-error)" }}
        >
          <AlertCircle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label htmlFor="login" className="input-label">Email ou pseudo</label>
        <div className="relative">
          <AtSign size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-on-surface-variant)" }} aria-hidden="true" />
          <input
            id="login"
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            className="input"
            style={{ paddingLeft: "42px" }}
            placeholder="vous@exemple.com ou mon_pseudo"
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="input-label">Mot de passe</label>
        <div className="relative">
          <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-on-surface-variant)" }} aria-hidden="true" />
          <input
            id="password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="input"
            style={{ paddingLeft: "42px", paddingRight: "48px" }}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={show}
            className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center rounded-lg"
            style={{ width: 44, height: 44, color: "var(--color-on-surface-variant)" }}
          >
            {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
        {loading ? (
          <><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Connexion…</>
        ) : (
          <>Se connecter <ArrowRight size={18} aria-hidden="true" /></>
        )}
      </button>
    </form>
  )
}
