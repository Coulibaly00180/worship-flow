"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FileText, Image as ImageIcon, Music, Trash2, Upload, ExternalLink, Pencil, AlertCircle, HelpCircle } from "lucide-react"
import { AbcScore } from "@/components/songs/AbcScore"
import { ScoreViewer } from "@/components/songs/ScoreViewer"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { ABC_TEMPLATE, VOICES, VOICE_LABEL, type Voice } from "@/lib/scoreFile"
import { YAML_EXAMPLE_FULL, YAML_TEMPLATE, compileYamlScore } from "@/lib/scoreYaml"

export type ScoreMeta = {
  id: string
  kind: string
  voice: string
  filename: string
  mimeType: string
  size: number
  abc: string | null
  source?: string | null
}

type Format = "yaml" | "abc"
type Draft = { id: string | null; title: string; voice: Voice; format: Format; text: string }

const voiceLabel = (v: string) => VOICE_LABEL[v as Voice] ?? v
const isWritten = (kind: string) => kind !== "FILE"

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
  const [draft, setDraft] = useState<Draft | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const presentVoices = Array.from(new Set(scores.map((s) => s.voice)))
  const visible = filter === "ALL_VOICES" ? scores : scores.filter((s) => s.voice === filter)

  // Aperçu en direct : le YAML est compilé dans le navigateur (le serveur recompile à l'enregistrement)
  const draftFormat = draft?.format
  const draftText = draft?.text ?? ""
  const compiled = useMemo(
    () => (draftFormat === "yaml" ? compileYamlScore(draftText) : null),
    [draftFormat, draftText],
  )
  const previewAbc = draft ? (draft.format === "yaml" ? (compiled?.ok ? compiled.abc : "") : draft.text) : ""
  const yamlErrors = compiled && !compiled.ok ? compiled.errors : []
  const yamlWarnings = compiled?.ok ? compiled.warnings : []

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
    if (draft.format === "yaml" && yamlErrors.length > 0) return toast.error("Corrigez d'abord les erreurs de la partition")
    setBusy(true)
    try {
      const isNew = draft.id === null
      const content = draft.format === "yaml" ? { source: draft.text } : { abc: draft.text }
      const res = await fetch(isNew ? `/api/songs/${songId}/scores` : `/api/songs/${songId}/scores/${draft.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isNew
            ? { kind: draft.format === "yaml" ? "YAML" : "ABC", title: draft.title, voice: draft.voice, ...content }
            : { title: draft.title, voice: draft.voice, ...content },
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
    setConfirmId(null)
    const res = await fetch(`/api/songs/${songId}/scores/${id}`, { method: "DELETE" })
    const json = await res.json()
    if (!json.ok) return toast.error(json.error ?? "Échec de la suppression")
    setScores((prev) => prev.filter((s) => s.id !== id))
    if (openId === id) setOpenId(null)
    toast.success("Partition supprimée")
  }

  const templateFor = (format: Format) =>
    format === "yaml"
      ? YAML_TEMPLATE.replace("titre: Mon chant", `titre: ${songTitle ? JSON.stringify(songTitle) : "Mon chant"}`)
      : ABC_TEMPLATE.replace("T:Titre", `T:${songTitle ?? "Titre"}`)

  function startNew() {
    setWarnings([])
    setDraft({ id: null, title: songTitle ?? "Partition", voice: uploadVoice, format: "yaml", text: templateFor("yaml") })
  }

  function startEdit(s: ScoreMeta) {
    setWarnings([])
    const yaml = s.kind === "YAML"
    setDraft({
      id: s.id,
      title: s.filename,
      voice: (VOICES as readonly string[]).includes(s.voice) ? (s.voice as Voice) : "ALL",
      format: yaml ? "yaml" : "abc",
      text: (yaml ? s.source : s.abc) ?? "",
    })
  }

  function switchFormat(format: Format) {
    if (!draft || draft.id !== null || draft.format === format) return
    // On ne remplace le texte que s'il est encore le modèle d'origine : jamais de saisie perdue
    const untouched = draft.text === templateFor(draft.format)
    setDraft({ ...draft, format, text: untouched ? templateFor(format) : draft.text })
  }

  if (scores.length === 0 && !canEdit) return null

  const opened = scores.find((s) => s.id === openId)
  const toDelete = scores.find((s) => s.id === confirmId)

  return (
    <section className="card mb-6 print:hidden" aria-labelledby="scores-title">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 id="scores-title" className="text-2xl font-bold">Partitions</h2>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="score-voice">Voix de la nouvelle partition</label>
            <select id="score-voice" value={uploadVoice} onChange={(e) => setUploadVoice(e.target.value as Voice)} className="input" style={{ width: "auto" }}>
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
              <Upload size={16} aria-hidden="true" />
              {busy ? "Envoi…" : "Fichier PDF / image"}
            </button>
            <button type="button" disabled={busy || draft !== null} onClick={startNew} className="btn btn-primary btn-sm">
              <Music size={16} aria-hidden="true" />
              Écrire une partition
            </button>
          </div>
        )}
      </div>

      {presentVoices.length > 1 && (
        <div className="scroll-x mb-4" style={{ gap: 8 }} role="group" aria-label="Filtrer par voix">
          {["ALL_VOICES", ...presentVoices].map((v) => (
            <button key={v} type="button" onClick={() => setFilter(v)} aria-pressed={filter === v} className="chip" data-active={filter === v}>
              {v === "ALL_VOICES" ? "Toutes" : voiceLabel(v)}
            </button>
          ))}
        </div>
      )}

      {draft && (
        <div className="mb-5 p-3 sm:p-4 rounded-xl" style={{ border: "2px solid var(--color-outline-variant)", background: "var(--color-surface-low)" }}>
          <h3 className="text-lg font-bold mb-3" style={{ fontFamily: "var(--font-sans)" }}>
            {draft.id === null ? "Nouvelle partition" : "Modifier la partition"}
          </h3>

          {draft.id === null && (
            <div role="radiogroup" aria-label="Format de saisie" className="grid grid-cols-2 gap-2 mb-4">
              {([
                ["yaml", "Solfège (YAML)", "Recommandé : do ré mi…, facile à écrire"],
                ["abc", "ABC (avancé)", "Notation ABC standard"],
              ] as const).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={draft.format === value}
                  onClick={() => switchFormat(value)}
                  className="rounded-xl border-2 px-3 py-2 text-left"
                  style={{
                    borderColor: draft.format === value ? "var(--color-primary)" : "var(--color-outline-variant)",
                    background: draft.format === value ? "var(--color-primary-container)" : "var(--color-surface)",
                    color: draft.format === value ? "var(--color-on-primary-container)" : "var(--color-on-surface)",
                  }}
                >
                  <span className="block font-bold">{label}</span>
                  <span className="block text-sm" style={{ opacity: 0.85 }}>{hint}</span>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="input-label" htmlFor="score-title">Titre</label>
              <input id="score-title" className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={120} />
            </div>
            <div>
              <label className="input-label" htmlFor="score-voice-edit">Voix concernée</label>
              <select id="score-voice-edit" className="input" value={draft.voice} onChange={(e) => setDraft({ ...draft, voice: e.target.value as Voice })}>
                {VOICES.map((v) => (
                  <option key={v} value={v}>{VOICE_LABEL[v]}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="input-label" htmlFor="score-source">{draft.format === "yaml" ? "Partition (YAML en solfège)" : "Notation ABC"}</label>
          <textarea
            id="score-source"
            className="input"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.9375rem", minHeight: 260 }}
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            spellCheck={false}
            autoCapitalize="none"
            aria-describedby="score-help"
            aria-invalid={yamlErrors.length > 0}
          />

          <details id="score-help" className="mt-2 mb-3">
            <summary className="inline-flex items-center gap-2 font-bold cursor-pointer" style={{ minHeight: 44, color: "var(--color-primary)" }}>
              <HelpCircle size={18} aria-hidden="true" /> Aide : comment écrire la partition
            </summary>
            {draft.format === "yaml" ? (
              <div className="mt-2 text-base" style={{ color: "var(--color-on-surface-variant)" }}>
                <ul className="list-disc pl-5 flex flex-col gap-1">
                  <li><b>Notes</b> : <code>do ré mi fa sol la si</code> (ou <code>C D E F G A B</code>). <code>do</code> = do du milieu du clavier ; <code>do&apos;</code> = octave au-dessus ; <code>do,</code> = octave en dessous.</li>
                  <li><b>Altérations</b> : <code>fa#</code> dièse, <code>sib</code> bémol, <code>fa=</code> bécarre. La tonalité s&apos;applique d&apos;elle-même (en Sol, <code>fa</code> est déjà dièse).</li>
                  <li><b>Durées</b> : <code>sol2</code> = 2 temps, <code>sol/2</code> = demi-temps, <code>sol3/2</code> = 1,5 temps, <code>sol2-</code> = liée à la suivante. <code>z</code> = silence.</li>
                  <li><b>Barres</b> : <code>|</code> mesure, <code>||</code> double barre, <code>|]</code> fin, <code>|:</code> et <code>:|</code> reprises.</li>
                  <li><b>Plusieurs voix</b> : une entrée par voix sous <code>voix:</code> (Soprano, Alto, Ténor, Basse : la clé de lecture est choisie pour vous).</li>
                  <li><b>Octave d&apos;une voix</b> : <code>octave: -1</code> sous la voix décale toutes ses notes d&apos;une octave (de -3 à 3). Un message vous prévient si une note sort de la tessiture de la voix.</li>
                  <li><b>Accords</b> : <code>@Sol</code>, <code>@Rém7</code>, <code>@Sib/Fa</code> devant la note concernée. Ils suivent la transposition.</li>
                  <li><b>Nuances</b> : <code>!p</code> <code>!mp</code> <code>!mf</code> <code>!f</code> <code>!ff</code>, crescendo <code>!cresc(</code> … <code>!cresc)</code>, decrescendo <code>!dim(</code> … <code>!dim)</code>, <code>!fermata</code>, <code>!accent</code>, <code>!staccato</code>.</li>
                  <li><b>Reprises</b> : <code>|:</code> <code>:|</code>, fins différentes <code>|1</code> et <code>:|2</code>, signes <code>!segno</code> <code>!coda</code> <code>!dc</code> (D.C.) <code>!ds</code> (D.S.) <code>!fine</code>. Texte au-dessus de la portée : <code>^Refrain_x2</code>.</li>
                  <li><b>Paroles</b> : coupez les syllabes avec un tiret : <code>Gra- ce in- fi- nie</code>. Une liste de plusieurs paroles = plusieurs couplets.</li>
                  <li>Indentez avec des <b>espaces</b> (jamais de tabulation), mettez une espace après chaque « : », et écrivez les notes dans un bloc <code>notes: |</code> quand elles commencent par <code>!</code> ou <code>@</code>.</li>
                </ul>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm mt-3"
                  disabled={!(draft.text.trim() === "" || draft.text === templateFor("yaml") || draft.text === YAML_EXAMPLE_FULL)}
                  onClick={() => setDraft({ ...draft, text: YAML_EXAMPLE_FULL })}
                  title="Disponible tant que vous n'avez pas modifié le modèle de départ"
                >
                  Charger un exemple complet (4 voix, accords, nuances)
                </button>
              </div>
            ) : (
              <p className="mt-2" style={{ color: "var(--color-on-surface-variant)" }}>
                Notation ABC : notes <code>C D E F G A B c</code>, durées <code>C2</code>, <code>C/2</code>, barres <code>|</code>, paroles <code>w:</code>. Plusieurs voix : lignes <code>V:1</code>, <code>V:2</code>.
              </p>
            )}
          </details>

          {yamlErrors.length > 0 && (
            <div role="alert" className="flex gap-2.5 items-start rounded-lg p-3 mb-3" style={{ background: "var(--color-error-bg)", color: "var(--color-error)", border: "1px solid var(--color-error)" }}>
              <AlertCircle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
              <ul className="flex flex-col gap-1">
                {yamlErrors.map((e, i) => (<li key={i}>{e}</li>))}
              </ul>
            </div>
          )}
          {yamlWarnings.length > 0 && (
            <ul className="mb-3 text-sm" role="status" style={{ color: "var(--color-secondary)" }}>
              {yamlWarnings.map((w, i) => (<li key={i}>⚠ {w}</li>))}
            </ul>
          )}

          <p className="text-base font-bold mb-1">Aperçu</p>
          {previewAbc ? (
            <AbcScore abc={previewAbc} onWarnings={setWarnings} />
          ) : (
            <p className="text-sm" style={{ color: "var(--color-on-surface-variant)" }}>L&apos;aperçu apparaît dès que la partition est valide.</p>
          )}
          {warnings.length > 0 && (
            <ul className="mt-2 text-sm" role="status" style={{ color: "var(--color-secondary)" }}>
              {warnings.slice(0, 5).map((w, i) => (<li key={i}>⚠ {w}</li>))}
            </ul>
          )}
          {draft.format === "yaml" && previewAbc && (
            <details className="mt-3">
              <summary className="cursor-pointer font-semibold" style={{ minHeight: 44, display: "flex", alignItems: "center" }}>Voir l&apos;ABC généré</summary>
              <pre className="mt-2 p-3 rounded-lg overflow-x-auto text-sm" style={{ background: "var(--color-surface-high)" }}>{previewAbc}</pre>
            </details>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
            <button type="button" className="btn btn-secondary" onClick={() => setDraft(null)}>Annuler</button>
            <button type="button" className="btn btn-primary" disabled={busy || yamlErrors.length > 0} onClick={saveDraft}>
              {busy ? "Enregistrement…" : "Enregistrer la partition"}
            </button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <p style={{ color: "var(--color-on-surface-variant)" }}>
          Aucune partition. Ajoutez un PDF ou une image (8 Mo max), ou écrivez-la directement en solfège.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((s) => {
            const Icon = isWritten(s.kind) ? Music : s.mimeType === "application/pdf" ? FileText : ImageIcon
            return (
              <li key={s.id} className="flex items-center gap-2 pl-3 rounded-xl" style={{ border: "1px solid var(--color-outline-variant)", background: "var(--color-surface)" }}>
                <Icon size={19} style={{ color: "var(--color-primary)" }} aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setOpenId(openId === s.id ? null : s.id)}
                  aria-expanded={openId === s.id}
                  className="flex-1 min-w-0 text-left font-semibold truncate hover:underline"
                  style={{ color: "var(--color-on-surface)", minHeight: 48 }}
                >
                  {s.filename}
                </button>
                <span className="key-badge shrink-0">{voiceLabel(s.voice)}</span>
                {s.kind === "YAML" && <span className="key-badge shrink-0 hidden sm:inline-flex">Solfège</span>}
                {s.kind === "FILE" && (
                  <a href={`/api/songs/${songId}/scores/${s.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir ${s.filename} dans un nouvel onglet`} className="icon-btn">
                    <ExternalLink size={18} aria-hidden="true" />
                  </a>
                )}
                {canEdit && isWritten(s.kind) && (
                  <button type="button" onClick={() => startEdit(s)} aria-label={`Modifier ${s.filename}`} className="icon-btn">
                    <Pencil size={18} aria-hidden="true" />
                  </button>
                )}
                {canEdit && (
                  <button type="button" onClick={() => setConfirmId(s.id)} aria-label={`Supprimer ${s.filename}`} className="icon-btn icon-btn-danger">
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {opened && (
        <div className="mt-4">
          {isWritten(opened.kind) ? (
            <ScoreViewer key={opened.id} abc={opened.abc ?? ""} />
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

      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer la partition"
        description={toDelete ? `Supprimer « ${toDelete.filename} » ? Cette action est irréversible.` : ""}
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={() => confirmId && remove(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </section>
  )
}
