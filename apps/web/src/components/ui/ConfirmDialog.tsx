"use client"

import { useId } from "react"
import { Modal } from "@/components/ui/Modal"

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

/** Confirmation d'une action. Le focus démarre sur « Annuler » : on ne confirme jamais par réflexe. */
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
  const titleId = useId()
  const descId = useId()

  return (
    <Modal open={open} onClose={onCancel} titleId={titleId} size="sm">
      <h2 id={titleId} className="text-xl font-bold mb-2">{title}</h2>

      {description && (
        <p id={descId} className="mb-6" style={{ color: "var(--color-on-surface-variant)" }}>{description}</p>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button type="button" data-autofocus onClick={onCancel} className="btn btn-secondary">
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={variant === "destructive" ? "btn btn-danger" : "btn btn-primary"}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
