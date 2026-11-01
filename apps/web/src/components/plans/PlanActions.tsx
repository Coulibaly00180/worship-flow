"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Copy, Printer } from "lucide-react"

/** Boutons "Dupliquer" et "Imprimer" de la fiche d'un plan (masqués à l'impression). */
export function PlanActions({ planId, canManage }: { planId: string; canManage: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState("")
  const [busy, setBusy] = useState(false)

  async function duplicate(e: React.FormEvent) {
    e.preventDefault()
    if (!date) return toast.error("Choisissez une date")
    setBusy(true)
    try {
      const res = await fetch(`/api/plans/${planId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: new Date(date).toISOString() }),
      })
      const json = await res.json()
      if (!json.ok) return toast.error(json.error ?? "Échec de la duplication")
      toast.success("Plan dupliqué")
      router.push(`/app/plans/${json.data.id}`)
      router.refresh()
    } catch {
      toast.error("Échec de la duplication")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="print:hidden flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button type="button" onClick={() => window.print()} className="btn btn-secondary btn-sm">
          <Printer size={14} />
          Imprimer
        </button>
        {canManage && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="btn btn-secondary btn-sm" aria-expanded={open}>
            <Copy size={14} />
            Dupliquer
          </button>
        )}
      </div>
      {canManage && open && (
        <form onSubmit={duplicate} className="card flex items-end gap-2" style={{ padding: "12px" }}>
          <div>
            <label htmlFor="dup-date" className="input-label">Nouvelle date</label>
            <input id="dup-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="input" />
          </div>
          <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
            {busy ? "…" : "Créer"}
          </button>
        </form>
      )}
    </div>
  )
}
