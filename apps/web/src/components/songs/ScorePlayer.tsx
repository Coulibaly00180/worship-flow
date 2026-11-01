"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { TuneObject } from "abcjs"
import { Play, Pause, Square, Loader2 } from "lucide-react"
import { SOUNDFONT_URL } from "@/lib/offline"

type Status = "idle" | "loading" | "playing" | "paused" | "error"

/** Programmes General MIDI : 52 = chœur « aah », 0 = piano. */
const INSTRUMENTS = [
  { value: 52, label: "Voix « aah »" },
  { value: 0, label: "Piano" },
] as const

type Tone = { btn: string; field: string; muted: string }
const STAGE_BTN = "inline-flex items-center gap-2 px-3 h-10 rounded-md text-sm font-semibold disabled:opacity-40"
const TONES: Record<string, Tone> = {
  app: { btn: "btn btn-secondary btn-sm", field: "input", muted: "var(--color-on-surface-variant)" },
  light: { btn: `${STAGE_BTN} bg-black/10 hover:bg-black/20 text-black`, field: "rounded-md px-2 h-10 bg-black/10 text-black", muted: "rgba(39,31,23,0.7)" },
  dark: { btn: `${STAGE_BTN} bg-white/10 hover:bg-white/20 text-white`, field: "rounded-md px-2 h-10 bg-white/10 text-white", muted: "rgba(255,255,255,0.7)" },
}

type Props = { visualObj: TuneObject | undefined; transpose: number; tone?: "app" | "light" | "dark" }

/**
 * Écoute de la partition affichée (toutes ses voix, ou la voix choisie), avec les notes qui s'allument.
 * Les sons (chœur et piano, banque FluidR3 GM, CC BY 3.0) sont hébergés avec l'application :
 * aucun appel externe, et ils restent disponibles hors-ligne une fois écoutés ou enregistrés.
 */
export function ScorePlayer({ visualObj, transpose, tone = "app" }: Props) {
  const [status, setStatus] = useState<Status>("idle")
  const [instrument, setInstrument] = useState<number>(52)
  const [tempo, setTempo] = useState(100)
  const [message, setMessage] = useState("")

  const synthRef = useRef<{ stop: () => void; pause: () => void; resume: () => void } | null>(null)
  const timingRef = useRef<{ start: () => void; pause: () => void; stop: () => void } | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const litRef = useRef<Element[]>([])
  const runRef = useRef(0) // invalide les démarrages devenus caducs (arrêt pendant le chargement)
  const pausingRef = useRef(false) // abcjs signale aussi « fin » quand on met en pause : on l'ignore alors

  const clearLit = useCallback(() => {
    litRef.current.forEach((e) => e.classList.remove("cp-playing"))
    litRef.current = []
  }, [])

  const stop = useCallback(() => {
    runRef.current++
    try { synthRef.current?.stop() } catch { /* déjà arrêté */ }
    try { timingRef.current?.stop() } catch { /* déjà arrêté */ }
    synthRef.current = null
    timingRef.current = null
    void ctxRef.current?.close().catch(() => undefined)
    ctxRef.current = null
    clearLit()
    setStatus("idle")
  }, [clearLit])

  // Toute nouvelle mise en page (voix, transposition, partition) arrête l'écoute en cours
  useEffect(() => stop, [visualObj, stop])

  async function start() {
    if (!visualObj) return
    const run = ++runRef.current
    setStatus("loading")
    setMessage("")
    try {
      const mod = await import("abcjs")
      const abcjs = mod.default ?? mod
      if (!abcjs.synth.supportsAudio()) throw new Error("audio")
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      ctxRef.current = ctx
      await ctx.resume()

      const baseQpm = (visualObj.getBpm?.() as number | undefined) || 90
      const qpm = Math.max(20, Math.round((baseQpm * tempo) / 100))
      const synth = new abcjs.synth.CreateSynth()
      await synth.init({
        visualObj,
        audioContext: ctx,
        millisecondsPerMeasure: visualObj.millisecondsPerMeasure(),
        options: {
          soundFontUrl: SOUNDFONT_URL,
          soundFontVolumeMultiplier: 3,
          program: instrument,
          qpm,
          visualTranspose: transpose,
          onEnded: () => { if (runRef.current === run && !pausingRef.current) stop() },
        },
      })
      await synth.prime()
      if (runRef.current !== run) return // arrêté pendant le chargement

      const timing = new abcjs.TimingCallbacks(visualObj, {
        qpm,
        eventCallback: (ev) => {
          clearLit()
          if (ev?.elements) {
            for (const group of ev.elements) for (const el of group) { el.classList.add("cp-playing"); litRef.current.push(el) }
          }
          return "continue"
        },
      })
      synthRef.current = synth
      timingRef.current = timing
      pausingRef.current = false
      synth.start()
      timing.start()
      setStatus("playing")
    } catch {
      if (runRef.current === run) {
        stop()
        setStatus("error")
        setMessage("Impossible de lancer le son (navigateur non compatible, ou sons indisponibles hors-ligne).")
      }
    }
  }

  function pause() {
    pausingRef.current = true
    synthRef.current?.pause()
    timingRef.current?.pause()
    setStatus("paused")
  }

  function resume() {
    pausingRef.current = false
    synthRef.current?.resume()
    timingRef.current?.start()
    setStatus("playing")
  }

  const t = TONES[tone]
  const busy = status === "loading"

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3" role="group" aria-label="Écoute de la partition">
      {status === "playing" ? (
        <button type="button" className={t.btn} onClick={pause}>
          <Pause size={16} aria-hidden="true" /> Pause
        </button>
      ) : (
        <button type="button" className={t.btn} disabled={!visualObj || busy} onClick={status === "paused" ? resume : start}>
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {busy ? "Chargement…" : status === "paused" ? "Reprendre" : "Écouter"}
        </button>
      )}
      <button type="button" className={t.btn} onClick={stop} disabled={status === "idle" || status === "error"} aria-label="Arrêter l'écoute">
        <Square size={14} aria-hidden="true" /> Arrêter
      </button>

      <label className="sr-only" htmlFor="player-instrument">Instrument</label>
      <select
        id="player-instrument"
        className={t.field}
        style={{ width: "auto", minHeight: 38 }}
        value={instrument}
        disabled={status !== "idle" && status !== "error"}
        onChange={(e) => setInstrument(Number(e.target.value))}
      >
        {INSTRUMENTS.map((i) => (
          <option key={i.value} value={i.value}>{i.label}</option>
        ))}
      </select>

      <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: t.muted }}>
        Tempo
        <input
          type="range"
          min={50}
          max={130}
          step={10}
          value={tempo}
          disabled={status !== "idle" && status !== "error"}
          onChange={(e) => setTempo(Number(e.target.value))}
          aria-valuetext={`${tempo} %`}
        />
        <span className="w-10 text-right">{tempo} %</span>
      </label>

      {message && <p role="alert" className="w-full text-sm" style={{ color: "var(--color-error)" }}>{message}</p>}
    </div>
  )
}
