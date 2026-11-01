"use client"

import { useCallback, useSyncExternalStore } from "react"

export type Theme = "system" | "light" | "dark"

const KEY = "cp-theme"
const EVENT = "cp-theme-change"

// Repli en mémoire si le stockage est indisponible (navigation privée…)
let memory: Theme = "system"

function normalize(v: unknown): Theme {
  return v === "light" || v === "dark" ? v : "system"
}

function read(): Theme {
  try {
    return normalize(window.localStorage.getItem(KEY) ?? memory)
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

/** Applique le thème sur <html> : « système » retire l'attribut et laisse prefers-color-scheme décider. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === "system") root.removeAttribute("data-theme")
  else root.setAttribute("data-theme", theme)
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme)

  const setTheme = useCallback((next: Theme) => {
    memory = next
    try {
      if (next === "system") window.localStorage.removeItem(KEY)
      else window.localStorage.setItem(KEY, next)
    } catch {
      // ignoré : repli sur la mémoire
    }
    applyTheme(next)
    window.dispatchEvent(new Event(EVENT))
  }, [])

  return [theme, setTheme]
}
