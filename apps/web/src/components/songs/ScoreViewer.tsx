"use client"

import { useMemo, useState } from "react"
import type { TuneObject } from "abcjs"
import { Minus, Plus } from "lucide-react"
import { AbcScore } from "@/components/songs/AbcScore"
import { ScorePlayer } from "@/components/songs/ScorePlayer"
import { ChordSheet } from "@/components/songs/ChordDiagram"
import { filterAbcVoices, listAbcVoices, matchVoiceId, voicePrefKey } from "@/lib/abcVoices"

export type ViewerTone = "app" | "light" | "dark"

type Props = {
  abc: string
  tone?: ViewerTone
  /** Voix à afficher d'emblée (SOPRANO, ALTO, TENOR, BASSE) quand la partition en a plusieurs. */
  preferredVoice?: string
  /** Appelé quand l'utilisateur ne garde qu'une voix reconnue (SOPRANO…) : permet de la mémoriser comme voix préférée. */
  onPreferredVoice?: (key: string) => void
}

const STAGE = {
  light: { on: "bg-black text-white", off: "bg-black/10 text-black/75 hover:bg-black/20", btn: "bg-black/10 hover:bg-black/20 text-black", muted: "text-black/60" },
  dark: { on: "bg-white text-[#17120e]", off: "bg-white/10 text-white/80 hover:bg-white/20", btn: "bg-white/10 hover:bg-white/20 text-white", muted: "text-white/60" },
} as const

/**
 * Visionneuse d'une partition écrite : choix des voix (une seule voix = page 4 fois plus courte sur téléphone),
 * transposition, écoute avec notes qui s'allument, et diagrammes d'accords pour la guitare.
 * `tone` adapte les couleurs au contexte (fiche du chant, ou mode scène clair/sombre).
 */
export function ScoreViewer({ abc, tone = "app", preferredVoice, onPreferredVoice }: Props) {
  const voices = useMemo(() => listAbcVoices(abc), [abc])
  const preferredId = useMemo(() => (preferredVoice ? matchVoiceId(voices, preferredVoice) : null), [voices, preferredVoice])

  const [transpose, setTranspose] = useState(0)
  // null = pas encore choisi : on affiche la voix préférée si elle existe, sinon toutes les voix
  const [picked, setPicked] = useState<string[] | null>(null)
  const [visualObj, setVisualObj] = useState<TuneObject | undefined>()
  const [chords, setChords] = useState<string[]>([])

  const selected = useMemo(
    () => picked ?? (preferredId ? [preferredId] : voices.map((v) => v.id)),
    [picked, preferredId, voices],
  )
  const displayAbc = useMemo(() => filterAbcVoices(abc, selected), [abc, selected])

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    if (next.length === 0) return
    setPicked(voices.map((v) => v.id).filter((x) => next.includes(x)))
    if (next.length === 1) {
      const key = voicePrefKey(voices.find((v) => v.id === next[0])?.name ?? "")
      if (key) onPreferredVoice?.(key)
    }
  }

  const stage = tone === "app" ? null : STAGE[tone]
  const chipClass = (active: boolean) =>
    stage ? `px-3 rounded-full text-sm font-semibold min-h-10 ${active ? stage.on : stage.off}` : "chip"
  const stepClass = stage ? `w-10 h-10 rounded-md flex items-center justify-center ${stage.btn}` : "btn btn-secondary btn-sm"
  const mutedClass = stage ? stage.muted : ""

  return (
    <div>
      {voices.length > 1 && (
        <div className="scroll-x mb-3" style={{ gap: 8 }} role="group" aria-label="Voix affichées et écoutées">
          {voices.map((v) => {
            const active = selected.includes(v.id)
            return (
              <button
                key={v.id}
                type="button"
                className={chipClass(active)}
                data-active={active}
                aria-pressed={active}
                onClick={() => toggle(v.id)}
                disabled={active && selected.length === 1}
                title={active && selected.length === 1 ? "Gardez au moins une voix" : undefined}
              >
                {v.name}
              </button>
            )
          })}
          {selected.length < voices.length && (
            <button type="button" className={chipClass(false)} onClick={() => setPicked(voices.map((v) => v.id))}>
              Toutes les voix
            </button>
          )}
        </div>
      )}

      <div className={`flex items-center gap-2 mb-2 ${mutedClass}`} style={stage ? undefined : { color: "var(--color-on-surface-variant)" }}>
        <span className="font-semibold">Transposition</span>
        <button type="button" className={stepClass} aria-label="Baisser d'un demi-ton" onClick={() => setTranspose((t) => Math.max(-12, t - 1))}>
          <Minus size={14} aria-hidden="true" />
        </button>
        <span className="w-10 text-center font-bold" aria-live="polite">{transpose > 0 ? `+${transpose}` : transpose}</span>
        <button type="button" className={stepClass} aria-label="Monter d'un demi-ton" onClick={() => setTranspose((t) => Math.min(12, t + 1))}>
          <Plus size={14} aria-hidden="true" />
        </button>
        {transpose !== 0 && (
          <button type="button" className={stage ? `px-3 h-9 rounded-md text-sm ${stage.btn}` : "btn btn-ghost btn-sm"} onClick={() => setTranspose(0)}>
            Réinitialiser
          </button>
        )}
      </div>

      <AbcScore
        abc={displayAbc}
        transpose={transpose}
        onRendered={({ visualObj: v, chords: c }) => {
          setVisualObj(v)
          setChords(c)
        }}
      />

      <ScorePlayer visualObj={visualObj} transpose={transpose} tone={tone} />
      <ChordSheet chords={chords} tone={tone} />
    </div>
  )
}
