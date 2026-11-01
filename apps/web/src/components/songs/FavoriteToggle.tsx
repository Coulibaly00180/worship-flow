"use client"

import { useState, useTransition } from "react"
import { Heart } from "lucide-react"
import { toast } from "sonner"

export function FavoriteToggle({ songId, initial }: { songId: string; initial: boolean }) {
  const [isFav, setIsFav] = useState(initial)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      const method = isFav ? "DELETE" : "POST"
      const res = await fetch(`/api/songs/${songId}/favorite`, { method })
      if (res.ok) {
        setIsFav(!isFav)
        toast.success(isFav ? "Retiré des favoris" : "Ajouté aux favoris")
      } else {
        toast.error("Impossible de mettre à jour les favoris. Réessayez.")
      }
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-pressed={isFav}
      aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
      className="grid place-items-center rounded-xl border disabled:opacity-60"
      style={{
        width: 44,
        height: 44,
        borderColor: isFav ? "var(--color-primary)" : "var(--color-outline)",
        background: isFav ? "var(--color-primary-container)" : "var(--color-surface)",
      }}
    >
      <Heart
        size={20}
        aria-hidden="true"
        style={isFav
          ? { fill: "var(--color-primary)", color: "var(--color-primary)" }
          : { color: "var(--color-on-surface-variant)" }
        }
      />
    </button>
  )
}
