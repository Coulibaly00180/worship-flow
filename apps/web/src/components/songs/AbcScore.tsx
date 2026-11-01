"use client"

import { useEffect, useRef, useState } from "react"

type Props = {
  abc: string
  /** Transposition visuelle en demi-tons (négatif = plus grave). */
  transpose?: number
  /** Appelé après chaque rendu avec les avertissements de syntaxe (texte brut). */
  onWarnings?: (warnings: string[]) => void
  className?: string
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim()

/**
 * Affiche une partition en notation ABC (abcjs, chargé à la demande : ~600 Ko).
 * Le rendu est fait côté client, donc disponible hors-ligne une fois la page en cache.
 */
export function AbcScore({ abc, transpose = 0, onWarnings, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const warningsRef = useRef(onWarnings)

  useEffect(() => {
    warningsRef.current = onWarnings
  }, [onWarnings])

  useEffect(() => {
    let cancelled = false
    import("abcjs")
      .then((mod) => {
        const el = ref.current
        if (cancelled || !el) return
        const abcjs = mod.default ?? mod
        const tunes = abcjs.renderAbc(el, abc, {
          responsive: "resize",
          visualTranspose: transpose,
          add_classes: true,
          paddingtop: 0,
          paddingbottom: 0,
          paddingleft: 0,
          paddingright: 0,
        })
        const warnings = (tunes?.[0]?.warnings ?? []).map(stripTags).filter(Boolean)
        warningsRef.current?.(warnings)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [abc, transpose])

  if (failed) {
    return (
      <p role="alert" className="text-sm" style={{ color: "var(--color-on-surface-variant)" }}>
        Impossible d&apos;afficher la partition (moteur de notation non chargé).
      </p>
    )
  }

  // Fond blanc : une partition se lit en noir sur blanc, même en thème sombre.
  return <div ref={ref} className={`bg-white text-black rounded-md p-3 overflow-x-auto ${className ?? ""}`} />
}
