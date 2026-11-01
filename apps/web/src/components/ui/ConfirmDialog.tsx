"use client"

import { X } from "lucide-react"

type Props = {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "default",
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "var(--color-scrim)" }}
      onClick={onCancel}
    >
      <div
        className="card w-full max-w-sm mx-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-outline-variant)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-base font-bold" style={{ color: "var(--color-on-surface)" }}>{title}</h2>
          <button type="button" onClick={onCancel} className="btn btn-ghost shrink-0" style={{ padding: "2px" }}>
            <X size={16} />
          </button>
        </div>

        {description && (
          <p className="text-sm mb-5" style={{ color: "var(--color-on-surface-variant)" }}>{description}</p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn btn-sm"
            style={variant === "destructive"
              ? { background: "var(--color-error-bg)", color: "var(--color-error)", border: "1px solid var(--color-error)" }
              : { background: "var(--color-primary)", color: "var(--color-on-primary)" }
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
