import Link from "next/link"
import { Heart, Music } from "lucide-react"
import { LearningBadge } from "./LearningBadge"

type SongCardProps = {
  id: string
  title: string
  artist?: string | null
  tags?: string[] | null
  isFavorite?: boolean
  hasScore?: boolean
  learningStatus?: "TO_LEARN" | "IN_PROGRESS" | "MASTERED" | null
}

/** Carte d'un chant : toute la carte est un lien vers la fiche (grande zone tactile). */
export function SongCard({ id, title, artist, tags, isFavorite, hasScore, learningStatus }: SongCardProps) {
  const tag = tags?.[0] ?? null

  return (
    <Link href={`/app/songs/${id}`} className="song-card" style={{ textDecoration: "none" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="song-card-title line-clamp-2">{title}</h3>
          {artist && <p className="song-card-artist mt-1 truncate">{artist}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {hasScore && <Music size={17} style={{ color: "var(--color-secondary)" }} aria-label="Partition disponible" role="img" />}
          {isFavorite && <Heart size={17} style={{ color: "var(--color-primary)", fill: "var(--color-primary)" }} aria-label="Favori" role="img" />}
        </div>
      </div>

      {(tag || learningStatus) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {tag && <span className="key-badge">{tag}</span>}
          <LearningBadge status={learningStatus ?? null} />
        </div>
      )}
    </Link>
  )
}
