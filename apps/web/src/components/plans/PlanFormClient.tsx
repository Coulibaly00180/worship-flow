"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2, Search, ChevronUp, ChevronDown, Copy } from "lucide-react"

type Song = { id: string; title: string; artist?: string | null }

type PlanItem = {
  id?: string
  order: number
  kind: string
  title?: string | null
  songId?: string | null
  song?: { id: string; title: string } | null
  content?: string | null
  notes?: string | null
  // Champs conservés tels quels à la sauvegarde (ne pas les perdre)
  refId?: string | null
  refSubId?: string | null
  mediaPath?: string | null
  secondaryContent?: string | null
  backgroundConfig?: string | null
}

const KIND_OPTIONS = [
  { value: "SONG_BLOCK", label: "Chant" },
  { value: "BIBLE_VERSE", label: "Verset biblique" },
  { value: "ANNOUNCEMENT_TEXT", label: "Annonce" },
  { value: "TIMER", label: "Minuteur" },
]

type Initial = {
  id: string
  date: Date
  title: string | null
  items: PlanItem[]
}

export function PlanFormClient({ initial }: { initial?: Initial }) {
  const router = useRouter()
  const isEdit = !!initial

  const [date, setDate] = useState(
    initial ? new Date(initial.date).toISOString().slice(0, 10) : ""
  )
  const [title, setTitle] = useState(initial?.title ?? "")
  const [items, setItems] = useState<PlanItem[]>(initial?.items ?? [])
  const [saving, startSaving] = useTransition()

  const [songQuery, setSongQuery] = useState("")
  const [songResults, setSongResults] = useState<Song[]>([])
  const [searchingFor, setSearchingFor] = useState<number | null>(null)

  useEffect(() => {
    if (!songQuery.trim()) return
    const t = setTimeout(async () => {
      const res = await fetch(`/api/songs?q=${encodeURIComponent(songQuery)}`)
      const json = await res.json()
      if (json.ok) setSongResults(json.data.slice(0, 8))
    }, 300)
    return () => clearTimeout(t)
  }, [songQuery])

  function addItem(kind = "SONG_BLOCK") {
    setItems((prev) => [...prev, { order: prev.length, kind, title: "" }])
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, order: i })))
  }

  function moveItem(idx: number, dir: -1 | 1) {
    setItems((prev) => {
      const target = idx + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next.map((it, i) => ({ ...it, order: i }))
    })
  }

  function duplicateItem(idx: number) {
    setItems((prev) => {
      const copy = { ...prev[idx], id: undefined }
      const next = [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]
      return next.map((it, i) => ({ ...it, order: i }))
    })
  }

  function updateItem(idx: number, patch: Partial<PlanItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function pickSong(idx: number, song: Song) {
    updateItem(idx, { songId: song.id, title: song.title, song: { id: song.id, title: song.title } })
    setSearchingFor(null)
    setSongQuery("")
    setSongResults([])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) return toast.error("La date est requise")

    startSaving(async () => {
      const url = isEdit ? `/api/plans/${initial!.id}` : "/api/plans"
      const method = isEdit ? "PATCH" : "POST"

      const planRes = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date(date).toISOString(),
          title: title.trim() || undefined,
        }),
      })
      const planJson = await planRes.json()
      if (!planJson.ok) { toast.error(planJson.error ?? "Erreur"); return }

      const planId = isEdit ? initial!.id : planJson.data.id

      const payload = items.map(({ id: _id, song: _song, ...it }, i) => ({ ...it, order: i }))
      if (isEdit || payload.length > 0) {
        const itemsRes = await fetch(`/api/plans/${planId}/items`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: payload }),
        })
        const itemsJson = await itemsRes.json()
        if (!itemsJson.ok) { toast.error(itemsJson.error ?? "Erreur sur les éléments"); return }
      }

      toast.success(isEdit ? "Plan modifié" : "Plan créé")
      router.push(`/app/plans/${planId}`)
      router.refresh()
    })
  }

  return (
    <div className="page-container max-w-2xl">
      <div className="page-header">
        <p className="eyebrow">Plans</p>
        <h1 className="page-title">
          {isEdit ? "Modifier le plan" : "Nouveau plan de service"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Info */}
        <div className="card">
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-primary)" }}>Informations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="input"
              />
            </div>
            <div>
              <label className="input-label">Titre (optionnel)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex : Culte dominical"
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>Ordre du service</h2>
            <div className="flex flex-wrap gap-1.5">
              {KIND_OPTIONS.slice(0, 2).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => addItem(value)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                >
                  + {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="overflow-hidden"
                style={{ border: "1px solid var(--color-outline-variant)", borderRadius: "var(--radius-md)" }}
              >
                <div
                  className="flex items-center gap-2 px-3 py-2"
                  style={{ background: "var(--color-surface-low)", borderBottom: "1px solid var(--color-outline-variant)" }}
                >
                  <div className="flex flex-col">
                    <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0} aria-label="Monter" className="disabled:opacity-30" style={{ color: "var(--color-outline)" }}>
                      <ChevronUp size={13} />
                    </button>
                    <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} aria-label="Descendre" className="disabled:opacity-30" style={{ color: "var(--color-outline)" }}>
                      <ChevronDown size={13} />
                    </button>
                  </div>
                  <select
                    value={item.kind}
                    onChange={(e) => updateItem(idx, { kind: e.target.value, songId: undefined, song: undefined })}
                    className="text-xs font-semibold bg-transparent border-none outline-none cursor-pointer"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {KIND_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <span className="ml-auto text-xs" style={{ color: "var(--color-outline)" }}>{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => duplicateItem(idx)}
                    aria-label="Dupliquer l'élément"
                    style={{ color: "var(--color-outline)" }}
                    className="transition-colors hover:text-white"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    aria-label="Supprimer l'élément"
                    style={{ color: "var(--color-outline)" }}
                    className="transition-colors hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="p-3" style={{ background: "var(--color-surface-low)" }}>
                  {item.kind === "SONG_BLOCK" ? (
                    <div className="relative">
                      {item.song ? (
                        <div
                          className="flex items-center justify-between px-3 py-2 rounded-md text-sm"
                          style={{ background: "rgba(255,255,255,0.06)" }}
                        >
                          <span className="font-medium" style={{ color: "var(--color-on-surface)" }}>{item.song.title}</span>
                          <button
                            type="button"
                            onClick={() => { updateItem(idx, { songId: undefined, title: "", song: undefined }); setSearchingFor(idx) }}
                            className="text-xs hover:underline"
                            style={{ color: "var(--color-secondary)" }}
                          >
                            Changer
                          </button>
                        </div>
                      ) : (
                        <>
                          <div
                            className="flex items-center gap-2 px-3 py-2 rounded-md cursor-text"
                            style={{ border: "1px solid var(--color-outline-variant)" }}
                            onClick={() => setSearchingFor(idx)}
                          >
                            <Search size={13} style={{ color: "var(--color-outline)" }} />
                            <input
                              value={searchingFor === idx ? songQuery : ""}
                              onChange={(e) => { setSearchingFor(idx); setSongQuery(e.target.value) }}
                              onFocus={() => setSearchingFor(idx)}
                              placeholder="Rechercher un chant…"
                              className="flex-1 text-sm bg-transparent outline-none"
                              style={{ color: "var(--color-on-surface)" }}
                            />
                          </div>
                          {searchingFor === idx && songQuery.trim() && songResults.length > 0 && (
                            <ul
                              className="absolute left-0 right-0 top-full mt-1 z-10 rounded-lg shadow-lg overflow-hidden"
                              style={{
                                background: "var(--color-surface-high)",
                                border: "1px solid var(--color-outline-variant)",
                              }}
                            >
                              {songResults.map((song) => (
                                <li key={song.id}>
                                  <button
                                    type="button"
                                    onClick={() => pickSong(idx, song)}
                                    className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                                    style={{ color: "var(--color-on-surface)" }}
                                  >
                                    <span className="font-medium">{song.title}</span>
                                    {song.artist && (
                                      <span className="ml-2" style={{ color: "var(--color-on-surface-variant)" }}>{song.artist}</span>
                                    )}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <input
                      value={item.title ?? ""}
                      onChange={(e) => updateItem(idx, { title: e.target.value })}
                      placeholder={item.kind === "TIMER" ? "Durée en secondes" : "Titre ou description…"}
                      className="input"
                    />
                  )}
                  <textarea
                    value={item.notes ?? ""}
                    onChange={(e) => updateItem(idx, { notes: e.target.value })}
                    placeholder="Notes (tonalité, intervenant, consigne…)"
                    rows={1}
                    maxLength={2000}
                    className="input mt-2 text-xs"
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => addItem()}
              className="flex items-center justify-center gap-2 py-3 rounded-lg text-sm transition-colors"
              style={{ border: "1px dashed var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}
            >
              <Plus size={14} />
              Ajouter un élément
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="btn btn-ghost btn-sm">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
            {saving ? "Sauvegarde…" : isEdit ? "Enregistrer" : "Créer le plan"}
          </button>
        </div>
      </form>
    </div>
  )
}
