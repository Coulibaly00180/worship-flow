"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Sun, Moon, Play, Pause, AlignJustify, Layers, Music, Minus, Plus } from "lucide-react"
import { AbcScore } from "@/components/songs/AbcScore"
import { useReadPrefs } from "@/lib/readPrefs"
import { VOICE_LABEL, type Voice } from "@/lib/scoreFile"

type Block = { id: string; order: number; type: string; title: string | null; content: string }
type Score = { id: string; kind: string; voice: string; filename: string; mimeType: string; abc: string | null }
type Song = { id: string; title: string; blocks: Block[] }

const blockTypeLabel: Record<string, string> = {
  VERSE: "Couplet",
  CHORUS: "Refrain",
  BRIDGE: "Bridge",
  INTRO: "Intro",
  OUTRO: "Outro",
  OTHER: "Autre",
}

type Tab = "lyrics" | "score"

/** Garde l'écran allumé tant que la page est visible (API Wake Lock, ignorée si non supportée). */
function useWakeLock() {
  const [active, setActive] = useState(false)
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const request = async () => {
      try {
        if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return
        lock = await navigator.wakeLock.request("screen")
        if (cancelled) { void lock.release(); return }
        setActive(true)
        lock.addEventListener("release", () => setActive(false))
      } catch {
        setActive(false) // refusé (économie d'énergie…) : sans conséquence
      }
    }
    void request()
    const onVisible = () => { if (document.visibilityState === "visible") void request() }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisible)
      void lock?.release()
    }
  }, [])
  return active
}

export function ReadModeClient({ song, scores = [] }: { song: Song; scores?: Score[] }) {
  const router = useRouter()
  const [prefs, setPrefs] = useReadPrefs()
  const wakeLock = useWakeLock()
  const [current, setCurrent] = useState(0)
  const [tab, setTab] = useState<Tab>("lyrics")
  const [playing, setPlaying] = useState(false)
  const [transpose, setTranspose] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const total = song.blocks.length
  const block = song.blocks[current]
  const light = prefs.theme === "light"

  // Partition affichée : celle de la voix préférée si elle existe, sinon la première.
  const sorted = [...scores].sort((a, b) => Number(b.voice === prefs.voice) - Number(a.voice === prefs.voice))
  const [pickedId, setPickedId] = useState<string | null>(null)
  const score = sorted.find((s) => s.id === pickedId) ?? sorted[0]

  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), [])
  const next = useCallback(() => setCurrent((c) => Math.min(total - 1, c + 1)), [total])

  // Clavier : flèches / espace / pages pour les blocs, Échap pour quitter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && ["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName)) return
      if (e.key === "Escape") router.push(`/app/songs/${song.id}`)
      else if (tab !== "lyrics") return
      else if (prefs.view === "blocks" && (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ")) { e.preventDefault(); next() }
      else if (prefs.view === "blocks" && (e.key === "ArrowLeft" || e.key === "PageUp")) { e.preventDefault(); prev() }
      else if (prefs.view === "scroll" && e.key === " ") { e.preventDefault(); setPlaying((p) => !p) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [next, prev, prefs.view, router, song.id, tab])

  // Défilement automatique (vue texte) : avance de `speed` px/s, s'arrête en bas
  useEffect(() => {
    if (!playing || prefs.view !== "scroll" || tab !== "lyrics") return
    const el = scrollRef.current
    if (!el) return
    let last = performance.now()
    let carry = 0
    let raf = 0
    const tick = (now: number) => {
      carry += ((now - last) / 1000) * prefs.speed
      last = now
      const whole = Math.floor(carry)
      if (whole > 0) {
        el.scrollTop += whole
        carry -= whole
      }
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) { setPlaying(false); return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, prefs.speed, prefs.view, tab])

  const btn = light ? "bg-black/10 hover:bg-black/20" : "bg-white/10 hover:bg-white/20"
  const muted = light ? "text-black/55" : "text-white/50"
  const faint = light ? "text-black/35" : "text-white/30"
  const border = light ? "border-black/10" : "border-white/10"

  return (
    <div className={`fixed inset-0 z-50 flex flex-col select-none ${light ? "bg-[#fbf8f2] text-[#271f17]" : "bg-[#17120e] text-white"}`}>
      {/* Barre du haut */}
      <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b ${border}`}>
        <Link href={`/app/songs/${song.id}`} aria-label="Quitter le mode lecture" className={`flex items-center gap-2 ${muted} hover:opacity-100`}>
          <X size={18} />
        </Link>
        <span className="text-sm font-semibold tracking-wide truncate max-w-[40%]">{song.title}</span>
        <div className="flex items-center gap-1.5">
          {scores.length > 0 && (
            <div className="flex rounded-lg overflow-hidden" role="tablist" aria-label="Contenu affiché">
              <button type="button" role="tab" aria-selected={tab === "lyrics"} onClick={() => setTab("lyrics")} className={`px-3 h-8 text-xs font-semibold ${tab === "lyrics" ? (light ? "bg-black text-white" : "bg-white text-[#17120e]") : btn}`}>Paroles</button>
              <button type="button" role="tab" aria-selected={tab === "score"} onClick={() => setTab("score")} className={`px-3 h-8 text-xs font-semibold flex items-center gap-1 ${tab === "score" ? (light ? "bg-black text-white" : "bg-white text-[#17120e]") : btn}`}><Music size={12} />Partition</button>
            </div>
          )}
          {tab === "lyrics" && (
            <button type="button" onClick={() => { setPlaying(false); setPrefs({ view: prefs.view === "blocks" ? "scroll" : "blocks" }) }} className={`w-8 h-8 rounded-lg flex items-center justify-center ${btn}`} title={prefs.view === "blocks" ? "Passer en texte défilant" : "Passer en blocs"} aria-label={prefs.view === "blocks" ? "Passer en texte défilant" : "Passer en blocs"}>
              {prefs.view === "blocks" ? <AlignJustify size={14} /> : <Layers size={14} />}
            </button>
          )}
          <button type="button" onClick={() => setPrefs({ fontSize: prefs.fontSize - 2 })} className={`w-8 h-8 rounded-lg flex items-center justify-center ${btn}`} title="Diminuer la taille" aria-label="Diminuer la taille du texte"><ZoomOut size={14} /></button>
          <span className={`text-xs w-6 text-center ${muted}`} aria-live="polite">{prefs.fontSize}</span>
          <button type="button" onClick={() => setPrefs({ fontSize: prefs.fontSize + 2 })} className={`w-8 h-8 rounded-lg flex items-center justify-center ${btn}`} title="Augmenter la taille" aria-label="Augmenter la taille du texte"><ZoomIn size={14} /></button>
          <button type="button" onClick={() => setPrefs({ theme: light ? "dark" : "light" })} className={`w-8 h-8 rounded-lg flex items-center justify-center ${btn}`} title={light ? "Thème sombre" : "Thème clair"} aria-label={light ? "Passer en thème sombre" : "Passer en thème clair"}>
            {light ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        </div>
      </div>

      {/* Contenu */}
      {tab === "score" && score ? (
        <div className="flex-1 overflow-auto p-4">
          <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
            <label className={muted} htmlFor="read-score-pick">Partition</label>
            <select
              id="read-score-pick"
              value={score.id}
              onChange={(e) => {
                const s = scores.find((x) => x.id === e.target.value)
                setPickedId(e.target.value)
                if (s) setPrefs({ voice: s.voice })
                setTranspose(0)
              }}
              className={`rounded-md px-2 py-1 ${light ? "bg-black/10 text-black" : "bg-white/10 text-white"}`}
            >
              {sorted.map((s) => (
                <option key={s.id} value={s.id} className="text-black">{s.filename} — {VOICE_LABEL[s.voice as Voice] ?? s.voice}</option>
              ))}
            </select>
            {score.kind === "ABC" && (
              <span className="flex items-center gap-1">
                <span className={muted}>Transposition</span>
                <button type="button" aria-label="Baisser d'un demi-ton" onClick={() => setTranspose((t) => Math.max(-12, t - 1))} className={`w-7 h-7 rounded-md flex items-center justify-center ${btn}`}><Minus size={12} /></button>
                <span className="w-8 text-center font-semibold" aria-live="polite">{transpose > 0 ? `+${transpose}` : transpose}</span>
                <button type="button" aria-label="Monter d'un demi-ton" onClick={() => setTranspose((t) => Math.min(12, t + 1))} className={`w-7 h-7 rounded-md flex items-center justify-center ${btn}`}><Plus size={12} /></button>
              </span>
            )}
          </div>
          {score.kind === "ABC" ? (
            <AbcScore abc={score.abc ?? ""} transpose={transpose} />
          ) : score.mimeType === "application/pdf" ? (
            <iframe title={score.filename} src={`/api/songs/${song.id}/scores/${score.id}`} className="w-full bg-white rounded-md" style={{ height: "calc(100vh - 150px)" }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/songs/${song.id}/scores/${score.id}`} alt={score.filename} className="w-full max-w-4xl mx-auto bg-white rounded-md" />
          )}
        </div>
      ) : prefs.view === "scroll" ? (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-10" onClick={() => setPlaying((p) => !p)} aria-label="Paroles complètes (toucher pour lancer ou arrêter le défilement)">
          <div className="max-w-2xl mx-auto text-center" style={{ fontSize: `${prefs.fontSize}px`, lineHeight: 1.7 }}>
            {song.blocks.map((b) => (
              <section key={b.id} className="mb-10">
                <p className={`text-xs font-semibold tracking-[0.2em] uppercase mb-3 ${muted}`}>{blockTypeLabel[b.type] ?? b.type}</p>
                <p className="whitespace-pre-line font-medium lyrics">{b.content}</p>
              </section>
            ))}
            <div style={{ height: "60vh" }} aria-hidden="true" />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <p className={`text-xs font-semibold tracking-[0.2em] uppercase mb-6 ${muted}`}>
            {blockTypeLabel[block?.type ?? ""] ?? block?.type ?? ""}
          </p>
          <p className="font-medium leading-relaxed whitespace-pre-line max-w-2xl lyrics" style={{ fontSize: `${prefs.fontSize}px`, lineHeight: 1.7 }}>
            {block?.content}
          </p>
          {current + 1 < total && (
            <p className={`mt-8 whitespace-pre-line max-w-2xl ${faint}`} style={{ fontSize: `${Math.max(12, prefs.fontSize - 6)}px`, lineHeight: 1.6 }}>
              {song.blocks[current + 1].content.split("\n").slice(0, 2).join("\n")}
            </p>
          )}
        </div>
      )}

      {/* Barre du bas */}
      <div className={`px-4 py-3 border-t ${border}`}>
        {tab === "lyrics" && prefs.view === "blocks" && (
          <>
            <div className="flex items-center justify-center gap-1.5 mb-3 flex-wrap">
              {song.blocks.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setCurrent(i)}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                    i === current ? (light ? "bg-black text-white" : "bg-white text-[#17120e]") : `${btn} ${muted}`
                  }`}
                >
                  {blockTypeLabel[b.type] ?? b.type}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-xs w-10 text-right ${muted}`}>{current + 1}/{total}</span>
              <div className={`flex-1 h-0.5 rounded-full overflow-hidden ${light ? "bg-black/10" : "bg-white/10"}`}>
                <div className={`h-full rounded-full transition-all ${light ? "bg-black/50" : "bg-white/50"}`} style={{ width: `${((current + 1) / Math.max(total, 1)) * 100}%` }} />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={prev} disabled={current === 0} aria-label="Bloc précédent" className={`w-10 h-10 rounded-full disabled:opacity-30 flex items-center justify-center ${btn}`}><ChevronLeft size={18} /></button>
                <button type="button" onClick={next} disabled={current >= total - 1} aria-label="Bloc suivant" className={`w-10 h-10 rounded-full disabled:opacity-30 flex items-center justify-center ${btn}`}><ChevronRight size={18} /></button>
              </div>
            </div>
          </>
        )}
        {tab === "lyrics" && prefs.view === "scroll" && (
          <div className="flex items-center justify-center gap-3">
            <button type="button" onClick={() => setPlaying((p) => !p)} className={`h-10 px-4 rounded-full flex items-center gap-2 text-sm font-semibold ${btn}`} aria-pressed={playing}>
              {playing ? <Pause size={16} /> : <Play size={16} />}
              {playing ? "Pause" : "Défiler"}
            </button>
            <label className={`flex items-center gap-2 text-xs ${muted}`}>
              Vitesse
              <input type="range" min={5} max={120} step={5} value={prefs.speed} onChange={(e) => setPrefs({ speed: Number(e.target.value) })} aria-label="Vitesse de défilement" />
            </label>
          </div>
        )}
        {tab === "score" && <p className={`text-center text-xs ${muted}`}>Pincez pour zoomer · Échap pour quitter</p>}
        <p className={`text-center text-[10px] mt-1 ${faint}`}>{wakeLock ? "Écran maintenu allumé" : ""}</p>
      </div>
    </div>
  )
}
