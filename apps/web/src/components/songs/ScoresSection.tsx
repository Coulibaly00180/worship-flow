"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FileText, Image as ImageIcon, Trash2, Upload, ExternalLink } from "lucide-react"

export type ScoreMeta = { id: string; filename: string; mimeType: string; size: number }

function formatSize(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`
}

export function ScoresSection({
  songId,
  initial,
  canEdit,
}: {
  songId: string
  initial: ScoreMeta[]
  canEdit: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [scores, setScores] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  async function upload(file: File) {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/songs/${songId}/scores`, { method: "POST", body: fd })
      const json = await res.json()
      if (!json.ok) return toast.error(json.error ?? "Échec de l'envoi")
      setScores((prev) => [...prev, json.data])
      toast.success("Partition ajoutée")
      router.refresh()
    } catch {
      toast.error("Échec de l'envoi")
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cette partition ?")) return
    const res = await fetch(`/api/songs/${songId}/scores/${id}`, { method: "DELETE" })
    const json = await res.json()
    if (!json.ok) return toast.error(json.error ?? "Échec de la suppression")
    setScores((prev) => prev.filter((s) => s.id !== id))
    if (openId === id) setOpenId(null)
    toast.success("Partition supprimée")
  }

  if (scores.length === 0 && !canEdit) return null

  const opened = scores.find((s) => s.id === openId)

  return (
    <section className="card mb-6" aria-labelledby="scores-title">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 id="scores-title" className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
          Partitions
        </h2>
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="btn btn-secondary btn-sm"
            >
              <Upload size={14} />
              {busy ? "Envoi…" : "Ajouter"}
            </button>
          </>
        )}
      </div>

      {scores.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-on-surface-variant)" }}>
          Aucune partition. Formats acceptés : PDF, PNG, JPEG (8 Mo max).
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {scores.map((s) => {
            const Icon = s.mimeType === "application/pdf" ? FileText : ImageIcon
            return (
              <li
                key={s.id}
                className="flex items-center gap-3 px-3 py-2 rounded-md"
                style={{ border: "1px solid var(--color-outline-variant)" }}
              >
                <Icon size={16} style={{ color: "var(--color-primary)" }} />
                <button
                  type="button"
                  onClick={() => setOpenId(openId === s.id ? null : s.id)}
                  className="flex-1 min-w-0 text-left text-sm truncate hover:underline"
                  style={{ color: "var(--color-on-surface)" }}
                >
                  {s.filename}
                </button>
                <span className="text-xs shrink-0" style={{ color: "var(--color-on-surface-variant)" }}>
                  {formatSize(s.size)}
                </span>
                <a
                  href={`/api/songs/${songId}/scores/${s.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ouvrir ${s.filename} dans un nouvel onglet`}
                  style={{ color: "var(--color-outline)" }}
                >
                  <ExternalLink size={14} />
                </a>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    aria-label={`Supprimer ${s.filename}`}
                    className="transition-colors hover:text-red-400"
                    style={{ color: "var(--color-outline)" }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {opened && (
        <div className="mt-4">
          {opened.mimeType === "application/pdf" ? (
            <iframe
              title={opened.filename}
              src={`/api/songs/${songId}/scores/${opened.id}`}
              className="w-full rounded-md"
              style={{ height: "70vh", border: "1px solid var(--color-outline-variant)" }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/songs/${songId}/scores/${opened.id}`}
              alt={opened.filename}
              className="w-full rounded-md bg-white"
            />
          )}
        </div>
      )}
    </section>
  )
}
