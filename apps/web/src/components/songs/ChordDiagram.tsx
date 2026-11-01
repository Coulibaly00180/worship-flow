import { guitarChord, type ChordShape } from "@/lib/guitarChords"
import { chordToFrench } from "@/lib/chords"

const STRING_NAMES = ["mi grave", "la", "ré", "sol", "si", "mi aigu"]

function describe(shape: ChordShape): string {
  return shape.frets
    .map((f, i) => `${STRING_NAMES[i]} ${f < 0 ? "non jouée" : f === 0 ? "à vide" : `case ${f}`}`)
    .join(", ")
}

/** Diagramme d'accord de guitare (6 cordes, 5 cases), en SVG, couleurs héritées du thème. */
export function ChordDiagram({ chord }: { chord: string }) {
  const shape = guitarChord(chord)
  const name = chordToFrench(chord)
  if (!shape) return null

  const left = 16, top = 24, sx = 10, sy = 12, rows = 5
  const x = (s: number) => left + s * sx
  const row = (fret: number) => fret - shape.baseFret + 1

  return (
    <figure className="m-0 text-center" style={{ width: 84 }}>
      <svg
        viewBox="0 0 84 96"
        width="84"
        height="96"
        role="img"
        aria-label={`Accord ${name} à la guitare : ${describe(shape)}`}
        style={{ color: "#111" }}
      >
        {/* cases */}
        {Array.from({ length: rows + 1 }, (_, j) => (
          <line key={`h${j}`} x1={x(0)} x2={x(5)} y1={top + j * sy} y2={top + j * sy} stroke="currentColor" strokeWidth={j === 0 && shape.baseFret === 1 ? 3 : 1} opacity={j === 0 && shape.baseFret === 1 ? 1 : 0.55} />
        ))}
        {/* cordes */}
        {Array.from({ length: 6 }, (_, s) => (
          <line key={`v${s}`} x1={x(s)} x2={x(s)} y1={top} y2={top + rows * sy} stroke="currentColor" strokeWidth={1} opacity={0.75} />
        ))}
        {/* numéro de la case de départ */}
        {shape.baseFret > 1 && (
          <text x={2} y={top + sy * 0.75} fontSize="9" fill="currentColor" fontWeight="700">{shape.baseFret}</text>
        )}
        {/* barré */}
        {shape.barre && row(shape.barre.fret) >= 1 && row(shape.barre.fret) <= rows && (
          <rect
            x={x(shape.barre.from) - 4}
            y={top + (row(shape.barre.fret) - 0.5) * sy - 4}
            width={x(shape.barre.to) - x(shape.barre.from) + 8}
            height={8}
            rx={4}
            fill="currentColor"
          />
        )}
        {/* cordes muettes / à vide et doigts */}
        {shape.frets.map((f, s) => {
          if (f < 0) return <text key={`m${s}`} x={x(s)} y={top - 7} fontSize="10" textAnchor="middle" fill="currentColor" fontWeight="700">×</text>
          if (f === 0) return <circle key={`o${s}`} cx={x(s)} cy={top - 10} r={3} fill="none" stroke="currentColor" strokeWidth={1.2} />
          const r = row(f)
          if (r < 1 || r > rows) return null
          return <circle key={`d${s}`} cx={x(s)} cy={top + (r - 0.5) * sy} r={4} fill="currentColor" />
        })}
      </svg>
      <figcaption className="text-sm font-bold" style={{ color: "#111" }}>{name}</figcaption>
    </figure>
  )
}

/** Grille des accords utilisés dans la partition, avec leur diagramme de guitare (sur fond blanc, comme la partition). */
export function ChordSheet({ chords, tone = "app" }: { chords: string[]; tone?: "app" | "light" | "dark" }) {
  const withShape = chords.filter((c) => guitarChord(c))
  const without = chords.filter((c) => !guitarChord(c))
  if (chords.length === 0) return null

  const summaryColor = tone === "dark" ? "#fff" : tone === "light" ? "#111" : "var(--color-primary)"
  const noteColor = tone === "dark" ? "rgba(255,255,255,0.7)" : tone === "light" ? "rgba(39,31,23,0.7)" : "var(--color-on-surface-variant)"

  return (
    <details className="mt-3">
      <summary className="cursor-pointer font-bold" style={{ minHeight: 44, display: "flex", alignItems: "center", color: summaryColor }}>
        Diagrammes d&apos;accords pour la guitare ({withShape.length})
      </summary>
      <div className="flex flex-wrap gap-4 mt-3 bg-white rounded-md p-3">
        {withShape.map((c) => (
          <ChordDiagram key={c} chord={c} />
        ))}
        {withShape.length === 0 && <p className="text-sm" style={{ color: "#444" }}>Aucun diagramme disponible pour ces accords.</p>}
      </div>
      {without.length > 0 && (
        <p className="text-sm mt-3" style={{ color: noteColor }}>
          Pas de diagramme pour : {without.map(chordToFrench).join(", ")}.
        </p>
      )}
    </details>
  )
}
