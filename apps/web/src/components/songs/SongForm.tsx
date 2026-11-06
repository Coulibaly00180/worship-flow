"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"

type BlockType = "VERSE" | "CHORUS" | "BRIDGE" | "INTRO" | "OUTRO" | "OTHER"

type Block = {
  id: string
  label: string
  type: BlockType
  content: string
  order: number
}

const BLOCK_TYPES: { value: BlockType; label: string }[] = [
  { value: "VERSE", label: "Couplet" },
  { value: "CHORUS", label: "Refrain" },
  { value: "BRIDGE", label: "Bridge" },
  { value: "INTRO", label: "Intro" },
  { value: "OUTRO", label: "Outro" },
  { value: "OTHER", label: "Autre" },
]

function newBlock(order: number): Block {
  return { id: crypto.randomUUID(), label: "Couplet", type: "VERSE", content: "", order }
}

type Props = {
  initial?: {
    id: string
    title: string
    artist?: string | null
    tags?: string[] | null
    blocks: { id: string; order: number; type: string; title?: string | null; content: string }[]
  }
}

export function SongForm({ initial }: Props) {
  const router = useRouter()
  const isEdit = !!initial

  const [title, setTitle] = useState(initial?.title ?? "")
  const [artist, setArtist] = useState(initial?.artist ?? "")
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "))
  const [blocks, setBlocks] = useState<Block[]>(
    initial?.blocks.length
      ? initial.blocks.map((b) => ({
          id: b.id,
          label: b.title ?? BLOCK_TYPES.find((t) => t.value === b.type)?.label ?? b.type,
          type: b.type as BlockType,
          content: b.content,
          order: b.order,
        }))
      : [newBlock(0), { ...newBlock(1), type: "CHORUS", label: "Refrain" }]
  )
  const [saving, setSaving] = useState(false)

  function addBlock(type: BlockType) {
    const label = BLOCK_TYPES.find((t) => t.value === type)?.label ?? type
    setBlocks((prev) => [...prev, { id: crypto.randomUUID(), label, type, content: "", order: prev.length }])
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i })))
  }

  function updateBlock(id: string, field: keyof Block, value: string) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return toast.error("Le titre est requis")
    if (blocks.length === 0) return toast.error("Au moins un bloc est requis")
    if (blocks.some((b) => !b.content.trim())) return toast.error("Tous les blocs doivent avoir du contenu")

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        artist: artist.trim() || undefined,
        // Toujours envoyé : un champ vidé efface les étiquettes
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        blocks: blocks.map((b, i) => ({
          label: b.label,
          type: b.type,
          content: b.content,
          order: i,
        })),
      }

      const url = isEdit ? `/api/songs/${initial!.id}` : "/api/songs"
      const method = isEdit ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!json.ok) {
        toast.error(json.error ?? "Erreur lors de la sauvegarde")
        return
      }

      toast.success(isEdit ? "Chant modifié" : "Chant créé")
      router.push(`/app/songs/${json.data.id}`)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      {/* Left col — Informations */}
      <div className="flex flex-col gap-6">
        <section className="card">
          <h2 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: "var(--color-primary)" }}>
            <span
              className="w-5 h-5 rounded-full text-xs flex items-center justify-center"
              style={{ background: "var(--color-primary)", color: "var(--color-on-primary)" }}
            >1</span>
            Informations
          </h2>

          <div className="flex flex-col gap-4">
            <div>
              <label className="input-label">Titre du chant *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex : Amazing Grace"
                required
                className="input"
              />
            </div>

            <div>
              <label className="input-label">Auteur / Compositeur</label>
              <input
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Nom de l'auteur"
                className="input"
              />
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: "var(--color-primary)" }}>
            <span
              className="w-5 h-5 rounded-full text-xs flex items-center justify-center"
              style={{ background: "var(--color-primary)", color: "var(--color-on-primary)" }}
            >2</span>
            Classification
          </h2>

          <div>
            <label className="input-label">Tags / Thèmes</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Louange, Rapide, Classique (séparés par des virgules)"
              className="input"
            />
            <p className="text-xs mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
              Séparer les tags par une virgule
            </p>
          </div>
        </section>
      </div>

      {/* Right col — Blocs */}
      <div className="flex flex-col gap-4">
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--color-primary)" }}>
              <span
                className="w-5 h-5 rounded-full text-xs flex items-center justify-center"
                style={{ background: "var(--color-primary)", color: "var(--color-on-primary)" }}
              >3</span>
              Structure &amp; Paroles
            </h2>
            <div className="flex gap-2">
              {[
                { type: "VERSE" as BlockType, label: "+ Couplet" },
                { type: "CHORUS" as BlockType, label: "+ Refrain" },
              ].map(({ type, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addBlock(type)}
                  className="btn btn-secondary btn-sm"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {blocks.map((block, idx) => (
              <div
                key={block.id}
                className="overflow-hidden"
                style={{ border: "1px solid var(--color-outline-variant)", borderRadius: "var(--radius-md)" }}
              >
                <div
                  className="flex items-center gap-2 px-3 py-1"
                  style={{
                    background: "var(--color-surface-low)",
                    borderBottom: "1px solid var(--color-outline-variant)",
                  }}
                >
                  <span
                    className="grid place-items-center rounded-full text-sm font-bold shrink-0"
                    style={{ width: 30, height: 30, background: "var(--color-primary)", color: "var(--color-on-primary)" }}
                    aria-hidden="true"
                  >
                    {idx + 1}
                  </span>
                  <select
                    value={block.type}
                    onChange={(e) => {
                      const t = e.target.value as BlockType
                      const lbl = BLOCK_TYPES.find((x) => x.value === t)?.label ?? t
                      updateBlock(block.id, "type", t)
                      updateBlock(block.id, "label", lbl)
                    }}
                    className="font-bold bg-transparent border-none outline-none cursor-pointer flex-1 min-w-0"
                    style={{ color: "var(--color-on-surface)", fontSize: "1rem", minHeight: 44 }}
                    aria-label={`Type du bloc ${idx + 1}`}
                  >
                    {BLOCK_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                                    {blocks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      className="icon-btn icon-btn-danger"
                      aria-label={`Supprimer le bloc ${idx + 1}`}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <textarea
                  value={block.content}
                  onChange={(e) => updateBlock(block.id, "content", e.target.value)}
                  placeholder="Saisir les paroles ici…"
                  rows={4}
                  className="w-full px-3 py-3 resize-y outline-none"
                  style={{
                    background: "var(--color-surface-low)",
                    color: "var(--color-on-surface)",
                    fontFamily: "var(--font-sans)",
                  }}
                />
              </div>
            ))}

            <button
              type="button"
              onClick={() => addBlock("VERSE")}
              className="flex items-center justify-center gap-2 py-3 rounded-lg text-sm transition-colors"
              style={{
                border: "1px dashed var(--color-outline-variant)",
                color: "var(--color-on-surface-variant)",
              }}
            >
              <Plus size={14} />
              Ajouter un bloc
            </button>
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="btn btn-ghost btn-sm">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
            {saving ? "Sauvegarde…" : isEdit ? "Enregistrer les modifications" : "Créer le chant"}
          </button>
        </div>
      </div>
    </form>
  )
}
