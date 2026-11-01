"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme, type Theme } from "@/lib/theme"

const OPTIONS: { value: Theme; label: string; icon: React.ElementType }[] = [
  { value: "system", label: "Auto", icon: Monitor },
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
]

/** Choix du thème : suit l'appareil (Auto) ou force clair / sombre. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useTheme()

  return (
    <div role="radiogroup" aria-label="Apparence" className={`flex gap-1 p-1 rounded-xl ${className ?? ""}`} style={{ background: "var(--color-surface-high)" }}>
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg text-sm font-semibold"
            style={{
              minHeight: "40px",
              background: active ? "var(--color-surface)" : "transparent",
              color: active ? "var(--color-on-surface)" : "var(--color-on-surface-variant)",
              boxShadow: active ? "var(--shadow-sm)" : "none",
            }}
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
