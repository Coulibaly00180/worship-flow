"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"
import {
  DEFAULT_APPEARANCE,
  STORAGE_KEY,
  appearanceAttributes,
  parseAppearance,
  type Appearance,
} from "@/lib/appearanceCore"
import { touchLocal } from "@/lib/syncMeta"

export const APPEARANCE_EVENT = "cp-appearance-change"

// Repli en mémoire si le stockage est indisponible (navigation privée…)
let memory = ""

function readRaw(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memory
  } catch {
    return memory
  }
}

export function readAppearance(): Appearance {
  return parseAppearance(readRaw())
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb)
  window.addEventListener(APPEARANCE_EVENT, cb)
  return () => {
    window.removeEventListener("storage", cb)
    window.removeEventListener(APPEARANCE_EVENT, cb)
  }
}

function apply(a: Appearance) {
  const root = document.documentElement
  for (const [name, value] of Object.entries(appearanceAttributes(a))) {
    if (value === null) root.removeAttribute(name)
    else root.setAttribute(name, value)
  }
}

/**
 * Enregistre et applique les réglages. `remote: true` = valeurs reçues du serveur (pas de
 * modification locale à renvoyer).
 */
export function writeAppearance(next: Appearance, opts?: { remote?: boolean }) {
  const json = JSON.stringify(next)
  memory = json
  try {
    window.localStorage.setItem(STORAGE_KEY, json)
  } catch {
    // ignoré : repli sur la mémoire
  }
  apply(next)
  if (!opts?.remote) touchLocal()
  window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT, { detail: { remote: !!opts?.remote } }))
}

/** Réglages d'apparence de cet appareil, appliqués immédiatement à toute l'application. */
export function useAppearance(): [Appearance, (patch: Partial<Appearance>) => void, () => void] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "")
  const appearance = useMemo(() => parseAppearance(raw), [raw])

  const update = useCallback((patch: Partial<Appearance>) => writeAppearance({ ...readAppearance(), ...patch }), [])
  const reset = useCallback(() => writeAppearance(DEFAULT_APPEARANCE), [])

  return [appearance, update, reset]
}
