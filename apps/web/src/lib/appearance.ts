"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"
import {
  DEFAULT_APPEARANCE,
  STORAGE_KEY,
  appearanceAttributes,
  parseAppearance,
  type Appearance,
} from "@/lib/appearanceCore"

const EVENT = "cp-appearance-change"

// Repli en mémoire si le stockage est indisponible (navigation privée…)
let memory = ""

function readRaw(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memory
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

function apply(a: Appearance) {
  const root = document.documentElement
  for (const [name, value] of Object.entries(appearanceAttributes(a))) {
    if (value === null) root.removeAttribute(name)
    else root.setAttribute(name, value)
  }
}

/** Réglages d'apparence de cet appareil, appliqués immédiatement à toute l'application. */
export function useAppearance(): [Appearance, (patch: Partial<Appearance>) => void, () => void] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "")
  const appearance = useMemo(() => parseAppearance(raw), [raw])

  const write = useCallback((next: Appearance) => {
    const json = JSON.stringify(next)
    memory = json
    try {
      window.localStorage.setItem(STORAGE_KEY, json)
    } catch {
      // ignoré : repli sur la mémoire
    }
    apply(next)
    window.dispatchEvent(new Event(EVENT))
  }, [])

  const update = useCallback(
    (patch: Partial<Appearance>) => write({ ...parseAppearance(readRaw()), ...patch }),
    [write],
  )
  const reset = useCallback(() => write(DEFAULT_APPEARANCE), [write])

  return [appearance, update, reset]
}
