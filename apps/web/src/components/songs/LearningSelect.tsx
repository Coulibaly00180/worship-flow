"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { CheckCircle2, Clock, BookOpen } from "lucide-react"

type Status = "TO_LEARN" | "IN_PROGRESS" | "MASTERED" | null

const options: { value: NonNullable<Status>; label: string; Icon: React.ElementType }[] = [
  { value: "TO_LEARN", label: "À apprendre", Icon: BookOpen },
  { value: "IN_PROGRESS", label: "En cours", Icon: Clock },
  { value: "MASTERED", label: "Maîtrisé", Icon: CheckCircle2 },
]

const activeStyles: Record<NonNullable<Status>, React.CSSProperties> = {
  MASTERED:    { background: "var(--color-mastered-bg)",  color: "var(--color-mastered)",  borderColor: "var(--color-mastered)" },
  IN_PROGRESS: { background: "var(--color-progress-bg)", color: "var(--color-progress)", borderColor: "var(--color-progress)" },
  TO_LEARN:    { background: "var(--color-learn-bg)",    color: "var(--color-learn)",    borderColor: "var(--color-learn)" },
}

/** Où j'en suis sur ce chant : trois choix exclusifs, chacun avec icône et texte. */
export function LearningSelect({ songId, initial }: { songId: string; initial: Status }) {
  const [status, setStatus] = useState<Status>(initial)
  const [isPending, startTransition] = useTransition()

  function handleChange(value: NonNullable<Status>) {
    startTransition(async () => {
      const res = await fetch(`/api/songs/${songId}/learning`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: value }),
      })
      if (res.ok) {
        setStatus(value)
        toast.success("Statut d'apprentissage mis à jour")
      } else {
        toast.error("Impossible de mettre à jour le statut. Réessayez.")
      }
    })
  }

  return (
    <div role="radiogroup" aria-label="Où j'en suis sur ce chant" className="flex flex-wrap gap-2">
      {options.map(({ value, label, Icon }) => {
        const active = status === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={isPending}
            onClick={() => handleChange(value)}
            className="inline-flex items-center gap-2 px-4 text-sm font-bold rounded-full border disabled:opacity-60"
            style={{
              minHeight: 44,
              ...(active
                ? activeStyles[value]
                : { background: "var(--color-surface)", color: "var(--color-on-surface-variant)", borderColor: "var(--color-outline)" }),
            }}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
