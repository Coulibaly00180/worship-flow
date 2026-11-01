"use client"

import { useEffect, useRef } from "react"

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

type Props = {
  open: boolean
  onClose: () => void
  /** id du titre (h2) du dialogue, pour aria-labelledby */
  titleId: string
  children: React.ReactNode
  /** Largeur maximale : sm = confirmation, md = formulaire */
  size?: "sm" | "md"
}

/**
 * Fenêtre modale accessible : rôle `dialog`, focus placé à l'ouverture (élément `data-autofocus`
 * ou premier champ), focus piégé au clavier, Échap pour fermer, focus rendu à l'élément d'origine,
 * défilement de la page bloqué. Un clic sur le fond ferme (sauf si on a glissé depuis le contenu).
 */
export function Modal({ open, onClose, titleId, children, size = "md" }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const dialog = ref.current
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const focusables = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => el.offsetParent !== null)
    const initial = dialog?.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0] ?? dialog
    initial?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key !== "Tab") return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !dialog?.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !dialog?.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = previousOverflow
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "var(--color-scrim)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeRef.current()
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`card w-full ${size === "sm" ? "sm:max-w-sm" : "sm:max-w-md"} overflow-y-auto`}
        style={{
          maxHeight: "92dvh",
          borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
          paddingBottom: "max(20px, env(safe-area-inset-bottom))",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {children}
      </div>
    </div>
  )
}
