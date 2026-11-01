"use client"

import { useCallback, useSyncExternalStore } from "react"
import { touchLocal } from "@/lib/syncMeta"

export type Theme = "system" | "light" | "dark"

const KEY = "cp-theme"
export const THEME_EVENT = "cp-theme-change"

// Repli en mémoire si le stockage est indisponible (navigation privée…)
let memory: Theme = "system"

function normalize(v: unknown): Theme {
  return v === "light" || v === "dark" ? v : "system"
}

export function readTheme(): Theme {
  try {
    return normalize(window.localStorage.getItem(KEY) ?? memory)
  } catch {
    return memory
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb)
  window.addEventListener(THEME_EVENT, cb)
  return () => {
    window.removeEventListener("storage", cb)
    window.removeEventListener(THEME_EVENT, cb)
  }
}

/** Applique le thème sur <html> : « système » retire l'attribut et laisse prefers-color-scheme décider. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === "system") root.removeAttribute("data-theme")
  else root.setAttribute("data-theme", theme)
}

/**
 * Enregistre et applique le thème. `remote: true` = valeur reçue du serveur : on ne marque pas
 * de modification locale et l'écouteur de synchronisation n'a rien à renvoyer.
 */
export function writeTheme(next: Theme, opts?: { remote?: boolean }) {
  memory = next
  try {
    if (next === "system") window.localStorage.removeItem(KEY)
    else window.localStorage.setItem(KEY, next)
  } catch {
    // ignoré : repli sur la mémoire
  }
  applyTheme(next)
  if (!opts?.remote) touchLocal()
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { remote: !!opts?.remote } }))
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme)
  const setTheme = useCallback((next: Theme) => writeTheme(next), [])
  return [theme, setTheme]
}
