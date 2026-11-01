"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FileText, Image as ImageIcon, Music, Trash2, Upload, ExternalLink, Pencil, Plus, Minus } from "lucide-react"
import { AbcScore } from "@/components/songs/AbcScore"
import { ABC_TEMPLATE, VOICES, VOICE_LABEL, type Voice } from "@/lib/scoreFile"

export type ScoreMeta = {
  id: string
  kind: string
  voice: string
  filename: string
  mimeType: string
  size: number
  abc: string | null
}

type Draft = { id: string | null; title: string; voice: Voice; abc: string }

function formatSize(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`
}

const voiceLabel = (v: string) => VOICE_LABEL[v as Voice] ?? v

export function ScoresSection({
  songId,
  songTitle,
  initial,
  canEdit,
}: {
  songId: string
  songTitle?: string
  initial: ScoreMeta[]
  canEdit: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [scores, setScores] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [uploadVoice, setUploadVoice] = useState<Voice>("ALL")
  const [filter, setFilter] = useState<string>("ALL_VOICES")
  const [transpose, setTranspose] = useState(0)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  const presentVoices = Array.from(new Set(scores.map((s) => s.voice)))
  const visible = filter === "ALL_VOICES" ? scores : scores.filter((s) => s.voice === filter)

  async function upload(file: File) {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("voice", uploadVoice)
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

  async function saveDraft() {
    if (!draft) return
    if (!draft.title.trim()) return toast.error("Donnez un titre à la partition")
    setBusy(true)
    try {
      const isNew = draft.id === null
      const res = await fetch(isNew ? `/api/songs/${songId}/scores` : `/api/songs/${songId}/scores/${draft.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isNew
            ? { kind: "ABC", title: draft.title, voice: draft.voice, abc: draft.abc }
            : { title: draft.title, voice: draft.voice, abc: draft.abc },
        ),
      })
      const json = await res.json()
      if (!json.ok) return toast.error(json.error ?? "Échec de l'enregistrement")
      setScores((prev) => (isNew ? [...prev, json.data] : prev.map((s) => (s.id === json.data.id ? { ...s, ...json.data } : s))))
      setOpenId(json.data.id)
      setDraft(null)
      toast.success(isNew ? "Partition créée" : "Partition enregistrée")
      router.refresh()
    } catch {
      toast.error("Échec de l'enregistrement")
    } finally {
      setBusy(false)
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

  function startNew() {
    setWarnings([])
    setDraft({ id: null, title: songTitle ?? "Partition", voice: uploadVoice, abc: ABC_TEMPLATE.replace("T:Titre", `T:${songTitle ?? "Titre"}`) })
  }

  function startEdit(s: ScoreMeta) {
    setWarnings([])
    setDraft({ id: s.id, title: s.filename, voice: (VOICES as readonly string[]).includes(s.voice) ? (s.voice as Voice) : "ALL", abc: s.abc ?? "" })
  }

  if (scores.length === 0 && !canEdit) return null

  const opened = scores.find((s) => s.id === openId)

  return (
    <section className="card mb-6 print:hidden" aria-labelledby="scores-title">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 id="scores-title" className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
          Partitions
        </h2>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="score-voice">Voix de la nouvelle partition</label>
            <select
              id="score-voice"
              value={uploadVoice}
              onChange={(e) => setUploadVoice(e.target.value as Voice)}
              className="input"
              style={{ width: "auto", padding: "4px 8px", fontSize: "0.8rem" }}
            >
              {VOICES.map((v) => (
                <option key={v} value={v}>{VOICE_LABEL[v]}</option>
              ))}
            </select>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="btn btn-secondary btn-sm">
              <Upload size={14} />
              {busy ? "Envoi…" : "Fichier"}
            </button>
            <button type="button" disabled={busy || draft !== null} onClick={startNew} className="btn btn-secondary btn-sm">
              <Music size={14} />
              Créer
            </button>
          </div>
        )}
      </div>

      {presentVoices.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label="Filtrer par voix">
          {["ALL_VOICES", ...presentVoices].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              aria-pressed={filter === v}
              className="px-3 py-1 text-xs font-semibold rounded-full transition-colors"
              style={{
                background: filter === v ? "var(--color-primary)" : "var(--color-surface-high)",
                color: filter === v ? "var(--color-bg)" : "var(--color-on-surface-variant)",
              }}
            >
              {v === "ALL_VOICES" ? "Toutes" : voiceLabel(v)}
            </button>
          ))}
        </div>
      )}

      {draft && (
        <div className="mb-4 p-3 rounded-md" style={{ border: "1px solid var(--color-outline-variant)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="input-label" htmlFor="abc-title">Titre</label>
              <input id="abc-title" className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={120} />
            </div>
            <div>
              <label className="input-label" htmlFor="abc-voice">Voix</label>
              <select id="abc-voice" className="input" value={draft.voice} onChange={(e) => setDraft({ ...draft, voice: e.target.value as Voice })}>
                {VOICES.map((v) => (
                  <option key={v} value={v}>{VOICE_LABEL[v]}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="input-label" htmlFor="abc-source">Notation ABC</label>
          <textarea
            id="abc-source"
            className="input"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.85rem", minHeight: "180px" }}
            value={draft.abc}
            onChange={(e) => setDraft({ ...draft, abc: e.target.value })}
            spellCheck={false}
          />
          <p className="text-xs mt-1 mb-3" style={{ color: "var(--color-on-surface-variant)" }}>
            Notes <code>C D E F G A B c</code>, durées <code>C2</code>, <code>C/2</code>, barres <code>|</code>, paroles <code>w:</code>.
            Plusieurs voix : lignes <code>V:1</code>, <code>V:2</code>. Aide : abcnotation.com/learn-abc-notation.
          </p>
          <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-on-surface-variant)" }}>Aperçu</p>
          <AbcScore abc={draft.abc} onWarnings={setWarnings} />
          {warnings.length > 0 && (
            <ul className="mt-2 text-xs" role="status" style={{ color: "var(--color-secondary)" }}>
              {warnings.slice(0, 5).map((w, i) => (<li key={i}>⚠ {w}</li>))}
            </ul>
          )}
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>Annuler</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={saveDraft}>
              {busy ? "…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-on-surface-variant)" }}>
          Aucune partition. Ajoutez un PDF / une image (8 Mo max) ou créez-en une en notation ABC.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((s) => {
            const Icon = s.kind === "ABC" ? Music : s.mimeType === "application/pdf" ? FileText : ImageIcon
            return (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-md" style={{ border: "1px solid var(--color-outline-variant)" }}>
                <Icon size={16} style={{ color: "var(--color-primary)" }} />
                <button
                  type="button"
                  onClick={() => { setOpenId(openId === s.id ? null : s.id); setTranspose(0) }}
                  aria-expanded={openId === s.id}
                  className="flex-1 min-w-0 text-left text-sm truncate hover:underline"
                  style={{ color: "var(--color-on-surface)" }}
                >
                  {s.filename}
                </button>
                <span className="text-xs shrink-0 px-2 py-0.5 rounded-full" style={{ background: "var(--color-surface-high)", color: "var(--color-on-surface-variant)" }}>
                  {voiceLabel(s.voice)}
                </span>
                <span className="text-xs shrink-0 hidden sm:inline" style={{ color: "var(--color-on-surface-variant)" }}>
                  {formatSize(s.size)}
                </span>
                {s.kind === "FILE" && (
                  <a
                    href={`/api/songs/${songId}/scores/${s.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Ouvrir ${s.filename} dans un nouvel onglet`}
                    style={{ color: "var(--color-outline)" }}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
                {canEdit && s.kind === "ABC" && (
                  <button type="button" onClick={() => startEdit(s)} aria-label={`Modifier ${s.filename}`} style={{ color: "var(--color-outline)" }}>
                    <Pencil size={14} />
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    aria-label={`Supprimer ${s.filename}`}
                    className="transition-colors hover:text-[var(--color-error)]"
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
          {opened.kind === "ABC" ? (
            <>
              <div className="flex items-center gap-2 mb-2 text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
                <span>Transposition</span>
                <button type="button" className="btn btn-secondary btn-sm" aria-label="Baisser d'un demi-ton" onClick={() => setTranspose((t) => Math.max(-12, t - 1))}>
                  <Minus size={12} />
                </button>
                <span className="w-10 text-center font-semibold" aria-live="polite">{transpose > 0 ? `+${transpose}` : transpose}</span>
                <button type="button" className="btn btn-secondary btn-sm" aria-label="Monter d'un demi-ton" onClick={() => setTranspose((t) => Math.min(12, t + 1))}>
                  <Plus size={12} />
                </button>
                {transpose !== 0 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTranspose(0)}>Réinitialiser</button>
                )}
              </div>
              <AbcScore abc={opened.abc ?? ""} transpose={transpose} />
            </>
          ) : opened.mimeType === "application/pdf" ? (
            <iframe
              title={opened.filename}
              src={`/api/songs/${songId}/scores/${opened.id}`}
              className="w-full rounded-md"
              style={{ height: "70vh", border: "1px solid var(--color-outline-variant)" }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/songs/${songId}/scores/${opened.id}`} alt={opened.filename} className="w-full rounded-md bg-white" />
          )}
        </div>
      )}
    </section>
  )
}
