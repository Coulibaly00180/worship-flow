"use client"

import { useEffect, useRef, useState } from "react"
import { chordToFrench } from "@/lib/chords"

type Props = {
  abc: string
  /** Transposition visuelle en demi-tons (négatif = plus grave). */
  transpose?: number
  /** Appelé après chaque rendu avec les avertissements de syntaxe (texte brut). */
  onWarnings?: (warnings: string[]) => void
  className?: string
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim()

/** Largeur approximative d'une mesure (px) pour répartir les mesures par ligne. */
const MEASURE_PX = 210
const PADDING_PX = 24

/** Réaffiche les noms d'accords en français (G7 → Sol7) : abcjs ne transpose que les noms anglais. */
function frenchChords(root: HTMLElement) {
  root.querySelectorAll<SVGTextElement>("text.abcjs-chord, .abcjs-chord text, .abcjs-chord").forEach((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.nodeValue ?? ""
      const converted = chordToFrench(text)
      if (converted !== text) n.nodeValue = converted
    }
  })
}

/**
 * Affiche une partition en notation ABC (abcjs, chargé à la demande : ~600 Ko).
 * Les portées sont recoupées à la largeur disponible (téléphone comme grand écran) et recalculées si elle change.
 * Le rendu est fait côté client, donc disponible hors-ligne une fois la page en cache.
 */
export function AbcScore({ abc, transpose = 0, onWarnings, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [width, setWidth] = useState(0)
  const warningsRef = useRef(onWarnings)

  useEffect(() => {
    warningsRef.current = onWarnings
  }, [onWarnings])

  // Largeur disponible, arrondie par pas de 24 px pour ne pas recalculer à chaque pixel
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === "undefined") return
    const update = () => setWidth(Math.round(el.clientWidth / 24) * 24)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (width === 0) return // pas encore mesuré
    let cancelled = false
    import("abcjs")
      .then((mod) => {
        const el = ref.current
        if (cancelled || !el) return
        const abcjs = mod.default ?? mod
        // Petit écran : la mise en page est calculée sur une largeur logique de 460 px (~2 mesures par ligne),
        // puis abcjs réduit le dessin à la largeur réelle ; grand écran : mise en page à la largeur disponible.
        const staffwidth = width < 520 ? 460 : Math.max(280, width - PADDING_PX)
        const tunes = abcjs.renderAbc(el, abc, {
          staffwidth,
          responsive: "resize",
          wrap: {
            minSpacing: 1.6,
            maxSpacing: 2.6,
            preferredMeasuresPerLine: Math.min(6, Math.max(1, Math.floor(staffwidth / MEASURE_PX))),
          },
          visualTranspose: transpose,
          add_classes: true,
          paddingtop: 0,
          paddingbottom: 0,
          paddingleft: 0,
          paddingright: 0,
        })
        frenchChords(el)
        const warnings = (tunes?.[0]?.warnings ?? []).map(stripTags).filter(Boolean)
        warningsRef.current?.(warnings)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [abc, transpose, width])

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
