"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileText, CheckCircle2, AlertCircle, X } from "lucide-react"
import { toast } from "sonner"

type ParsedBlock = {
  type: string
  label: string
  content: string
  order: number
}

type DetectedSong = {
  file: string
  ok: boolean
  error?: string
  song?: { title: string; artist?: string; blocks: ParsedBlock[] }
  exists?: boolean
  existingId?: string | null
}

type ConflictMode = "IGNORE" | "OVERWRITE"

export function ImportClient() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [detected, setDetected] = useState<DetectedSong[]>([])
  const [mode, setMode] = useState<ConflictMode>("IGNORE")
  const [importing, setImporting] = useState(false)

  async function handleFiles(files: File[]) {
    const allowed = files.filter((f) => f.name.endsWith(".txt") || f.name.endsWith(".docx"))
    if (!allowed.length) {
      toast.error("Seuls les fichiers .txt et .docx sont acceptés")
      return
    }
    setParsing(true)
    setDetected([])
    try {
      const fd = new FormData()
      allowed.forEach((f) => fd.append("files", f))
      const res = await fetch("/api/songs/import", { method: "POST", body: fd })
      const json = await res.json()
      if (json.ok) setDetected(json.data)
      else toast.error(json.error ?? "Erreur lors du parsing")
    } finally {
      setParsing(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }, [])

  async function processImport() {
    const valid = detected.filter((d) => d.ok && d.song)
    if (!valid.length) return
    setImporting(true)
    try {
      const res = await fetch("/api/songs/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songs: valid.map((d) => d.song), mode }),
      })
      const json = await res.json()
      if (json.ok) {
        const { created, updated, skipped } = json.data
        toast.success(`Import terminé : ${created} créés, ${updated} mis à jour, ${skipped} ignorés`)
        router.push("/app/songs")
        router.refresh()
      } else {
        toast.error(json.error ?? "Erreur lors de l'import")
      }
    } finally {
      setImporting(false)
    }
  }

  const readySongs = detected.filter((d) => d.ok && d.song)
  const failedSongs = detected.filter((d) => !d.ok)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Left — drop zone + options */}
      <div className="flex flex-col gap-5">
        {/* Drop zone */}
        <div
          onDragEnter={(e) => { e.preventDefault(); setDragging(true) }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className="relative p-12 text-center cursor-pointer transition-all rounded-xl"
          style={{
            border: `2px dashed ${dragging ? "var(--color-secondary)" : "var(--color-outline-variant)"}`,
            background: dragging ? "var(--color-primary-container)" : "transparent",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.docx"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
          />
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--color-surface-high)" }}
          >
            <Upload size={22} style={{ color: "var(--color-on-surface-variant)" }} />
          </div>
          <p className="font-semibold" style={{ color: "var(--color-on-surface)" }}>
            {parsing ? "Analyse en cours…" : "Glisser-déposer des fichiers"}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
            ou cliquer pour parcourir
          </p>
          <div className="flex justify-center gap-2 mt-4">
            {[".TXT", ".DOCX"].map((ext) => (
              <span key={ext} className="key-badge">{ext}</span>
            ))}
          </div>
        </div>

        {/* Conflict resolution */}
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-on-surface-variant)" }}>
            Résolution des conflits
          </p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: "IGNORE", label: "Ignorer les doublons", desc: "Passe les chants dont le titre existe déjà." },
              { value: "OVERWRITE", label: "Écraser", desc: "Met à jour les chants existants avec les nouvelles paroles." },
            ] as { value: ConflictMode; label: string; desc: string }[]).map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className="text-left p-3 rounded-lg transition-all"
                style={{
                  border: `2px solid ${mode === value ? "var(--color-secondary)" : "var(--color-outline-variant)"}`,
                  background: mode === value ? "var(--color-primary-container)" : "transparent",
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                    style={{ borderColor: mode === value ? "var(--color-secondary)" : "var(--color-outline)" }}
                  >
                    {mode === value && (
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-secondary)" }} />
                    )}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: "var(--color-on-surface)" }}>{label}</span>
                </div>
                <p className="text-xs leading-snug pl-5" style={{ color: "var(--color-on-surface-variant)" }}>{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => { setDetected([]); router.back() }}
            className="btn btn-ghost btn-sm"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={processImport}
            disabled={!readySongs.length || importing}
            className="btn btn-primary btn-sm"
          >
            {importing ? "Import…" : `Lancer l'import`}
            {!importing && readySongs.length > 0 && (
              <span
                className="text-xs px-1.5 rounded-full ml-1"
                style={{ background: "var(--color-surface-high)" }}
              >{readySongs.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Right — detected songs */}
      <div className="card-flat overflow-hidden" style={{ padding: 0, borderRadius: "var(--radius-xl)" }}>
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ background: "var(--color-surface-low)", borderBottom: "1px solid var(--color-outline-variant)" }}
        >
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-on-surface-variant)" }}>
            Chants détectés
          </span>
          {readySongs.length > 0 && (
            <span className="badge badge-mastered">
              {readySongs.length} prêt{readySongs.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {detected.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: "var(--color-on-surface-variant)" }}>
            <FileText size={24} className="mx-auto mb-2 opacity-20" />
            <p>Aucun fichier analysé.</p>
            <p className="text-xs mt-1">Déposez des fichiers pour commencer.</p>
          </div>
        ) : (
          <ul style={{ borderBottom: "none" }}>
            {detected.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-3 px-5 py-4"
                style={{ borderBottom: "1px solid var(--color-outline-variant)" }}
              >
                <div className="mt-0.5 shrink-0" style={{ color: item.ok ? "var(--color-mastered)" : "var(--color-error)" }}>
                  {item.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  {item.ok && item.song ? (
                    <>
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--color-on-surface)" }}>
                        {item.song.title}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
                          {item.song.blocks.length} bloc{item.song.blocks.length > 1 ? "s" : ""} détecté{item.song.blocks.length > 1 ? "s" : ""}
                        </span>
                        {item.exists && (
                          <span className="text-xs font-medium" style={{ color: "var(--color-progress)" }}>
                            ⚠ Existe déjà
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--color-error)" }}>{item.file}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-on-surface-variant)" }}>{item.error}</p>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDetected((prev) => prev.filter((_, j) => j !== i))}
                  className="shrink-0 transition-colors"
                  style={{ color: "var(--color-outline)" }}
                >
                  <X size={13} />
                </button>
              </li>
            ))}

            {failedSongs.length > 0 && readySongs.length > 0 && (
              <li className="px-5 py-3 text-xs" style={{ color: "var(--color-on-surface-variant)", background: "var(--color-surface-low)" }}>
                {failedSongs.length} fichier{failedSongs.length > 1 ? "s" : ""} échoué{failedSongs.length > 1 ? "s" : ""} — ignoré{failedSongs.length > 1 ? "s" : ""}
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
