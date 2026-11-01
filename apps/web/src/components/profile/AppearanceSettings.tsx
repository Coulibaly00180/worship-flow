"use client"

import { Check, RotateCcw } from "lucide-react"
import accentData from "@/lib/accents.json"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { useAppearance } from "@/lib/appearance"
import { useTheme } from "@/lib/theme"
import { ACCENT_IDS, type Appearance } from "@/lib/appearanceCore"

type Choice<T extends string> = { value: T; label: string; sample?: React.ReactNode }

/** Groupe de choix exclusifs (boutons radio visuels), navigable au clavier avec les flèches. */
function Segmented<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string
  value: T
  options: Choice<T>[]
  onChange: (v: T) => void
}) {
  return (
    <fieldset className="border-0 p-0 m-0">
      <legend className="input-label">{legend}</legend>
      <div role="radiogroup" aria-label={legend} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const active = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 font-bold"
              style={{
                minHeight: 64,
                borderColor: active ? "var(--color-primary)" : "var(--color-outline-variant)",
                background: active ? "var(--color-primary-container)" : "var(--color-surface)",
                color: active ? "var(--color-on-primary-container)" : "var(--color-on-surface)",
              }}
            >
              {o.sample && <span aria-hidden="true" className="leading-none">{o.sample}</span>}
              <span className="text-sm">{o.label}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Personnalisation de l'interface : enregistrée sur cet appareil, appliquée immédiatement. */
export function AppearanceSettings() {
  const [prefs, update, reset] = useAppearance()
  const [, setTheme] = useTheme()
  const accents = accentData.accents as Record<string, { label: string; swatch: string; light: Record<string, string> }>

  return (
    <section className="card" aria-labelledby="personalize">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 id="personalize" className="text-xl font-bold">Personnaliser l&apos;interface</h2>
          <p className="text-sm mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
            Ces réglages sont mémorisés sur cet appareil et s&apos;appliquent tout de suite.
          </p>
        </div>
        <button type="button" onClick={() => { reset(); setTheme("system") }} className="btn btn-ghost btn-sm shrink-0" aria-label="Rétablir les réglages d'origine">
          <RotateCcw size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Rétablir</span>
        </button>
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <p className="input-label">Thème</p>
          <ThemeToggle />
          <p className="text-sm mt-2" style={{ color: "var(--color-on-surface-variant)" }}>« Auto » suit le réglage de votre appareil.</p>
        </div>

        <fieldset className="border-0 p-0 m-0">
          <legend className="input-label">Couleur d&apos;accent</legend>
          <div role="radiogroup" aria-label="Couleur d'accent" className="flex flex-wrap gap-3">
            {ACCENT_IDS.map((id) => {
              const a = accents[id]
              const active = prefs.accent === id
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={a.label}
                  title={a.label}
                  onClick={() => update({ accent: id })}
                  className="grid place-items-center rounded-full"
                  style={{
                    width: 52,
                    height: 52,
                    background: a.swatch,
                    color: a.light["on-primary"],
                    outline: active ? "3px solid var(--color-on-surface)" : "3px solid transparent",
                    outlineOffset: 3,
                  }}
                >
                  {active && <Check size={24} strokeWidth={3} aria-hidden="true" />}
                </button>
              )
            })}
          </div>
          <p className="text-sm mt-2" style={{ color: "var(--color-on-surface-variant)" }} aria-live="polite">
            {accents[prefs.accent]?.label}
          </p>
        </fieldset>

        <Segmented<Appearance["textSize"]>
          legend="Taille du texte"
          value={prefs.textSize}
          onChange={(v) => update({ textSize: v })}
          options={[
            { value: "normal", label: "Normal", sample: <span style={{ fontSize: 18 }}>Aa</span> },
            { value: "large", label: "Grand", sample: <span style={{ fontSize: 22 }}>Aa</span> },
            { value: "xlarge", label: "Très grand", sample: <span style={{ fontSize: 27 }}>Aa</span> },
          ]}
        />

        <Segmented<Appearance["lyricsFont"]>
          legend="Police des paroles"
          value={prefs.lyricsFont}
          onChange={(v) => update({ lyricsFont: v })}
          options={[
            { value: "sans", label: "Lisible", sample: <span style={{ fontFamily: "var(--font-sans)", fontSize: 22 }}>Aa</span> },
            { value: "serif", label: "Recueil", sample: <span style={{ fontFamily: "var(--font-serif)", fontSize: 22 }}>Aa</span> },
          ]}
        />

        <Segmented<Appearance["motion"]>
          legend="Animations"
          value={prefs.motion}
          onChange={(v) => update({ motion: v })}
          options={[
            { value: "auto", label: "Selon l'appareil" },
            { value: "reduce", label: "Réduites" },
          ]}
        />
      </div>
    </section>
  )
}
