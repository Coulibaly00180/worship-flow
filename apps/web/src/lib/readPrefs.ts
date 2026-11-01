"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"

export type ReadPrefs = {
  fontSize: number
  theme: "dark" | "light"
  /** Vue des paroles : bloc par bloc, ou texte entier avec défilement. */
  view: "blocks" | "scroll"
  /** Vitesse de défilement automatique, en pixels par seconde. */
  speed: number
  /** Voix préférée : sélectionnée d'office dans l'onglet partitions. */
  voice: string
}

export const DEFAULT_PREFS: ReadPrefs = { fontSize: 24, theme: "dark", view: "blocks", speed: 30, voice: "ALL" }

const KEY = "cp-read-prefs"
const EVENT = "cp-read-prefs-change"

// Repli en mémoire si le stockage est indisponible (navigation privée…) : les réglages restent actifs le temps de la page
let memory = ""

function readRaw(): string {
  try {
    return window.localStorage.getItem(KEY) ?? memory
  } catch {
    return memory
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb)
  window.addEventListener(EVENT, cb)
  return () => {
    window.removeEventListener("storage", cb)
    window.removeEventListener(EVENT, cb)
  }
}

/** Valide et borne des préférences issues du stockage (qui peut être altéré ou ancien). */
export function parsePrefs(raw: string): ReadPrefs {
  try {
    const o = JSON.parse(raw) as Partial<ReadPrefs>
    const num = (v: unknown, min: number, max: number, d: number) =>
      typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d
    return {
      fontSize: num(o.fontSize, 14, 56, DEFAULT_PREFS.fontSize),
      theme: o.theme === "light" ? "light" : "dark",
      view: o.view === "scroll" ? "scroll" : "blocks",
      speed: num(o.speed, 5, 120, DEFAULT_PREFS.speed),
      voice: typeof o.voice === "string" ? o.voice.slice(0, 30) : "ALL",
    }
  } catch {
    return DEFAULT_PREFS
  }
}

/** Préférences de lecture persistées dans le navigateur (sans désynchronisation SSR). */
export function useReadPrefs(): [ReadPrefs, (patch: Partial<ReadPrefs>) => void] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "")
  const prefs = useMemo(() => (raw ? parsePrefs(raw) : DEFAULT_PREFS), [raw])

  const update = useCallback((patch: Partial<ReadPrefs>) => {
    const next = JSON.stringify({ ...parsePrefs(readRaw()), ...patch })
    memory = next
    try {
      window.localStorage.setItem(KEY, next)
    } catch {
      // ignoré : repli sur la mémoire
    }
    window.dispatchEvent(new Event(EVENT))
  }, [])

  return [prefs, update]
}
