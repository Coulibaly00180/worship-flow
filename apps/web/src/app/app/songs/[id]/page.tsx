import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Eye, Pencil, Music } from "lucide-react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { LearningBadge } from "@/components/songs/LearningBadge"
import { FavoriteToggle } from "@/components/songs/FavoriteToggle"
import { LearningSelect } from "@/components/songs/LearningSelect"
import { ScoresSection } from "@/components/songs/ScoresSection"
import { canEditSongs } from "@/lib/roles"

type Props = { params: Promise<{ id: string }> }

const blockTypeLabel: Record<string, string> = {
  VERSE: "Couplet",
  CHORUS: "Refrain",
  BRIDGE: "Bridge",
  INTRO: "Intro",
  OUTRO: "Outro",
  OTHER: "Autre",
}

export default async function SongDetailPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect("/login")

  const { id } = await params

  const song = await prisma.song.findUnique({
    where: { id },
    include: {
      blocks: { orderBy: { order: "asc" } },
      favorites: { where: { userId: session.user.id }, select: { userId: true } },
      learnings: { where: { userId: session.user.id }, select: { status: true } },
      scores: { orderBy: { createdAt: "asc" }, select: { id: true, filename: true, mimeType: true, size: true } },
    },
  })

  if (!song || song.deletedAt) notFound()

  const isFavorite = song.favorites.length > 0
  const learningStatus = song.learnings[0]?.status ?? null

  function parseTags(tags: string | null): string[] {
    if (!tags) return []
    try {
      const arr = JSON.parse(tags)
      return Array.isArray(arr) ? arr.map(String) : []
    } catch {
      return []
    }
  }

  const tags = parseTags(song.tags)

  return (
    <div className="page-container max-w-3xl">
      <Link
        href="/app/songs"
        className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors"
        style={{ color: "var(--color-on-surface-variant)" }}
      >
        <ArrowLeft size={14} />
        Retour à la bibliothèque
      </Link>

      {/* Header card */}
      <div className="card mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {tags.map((t) => (
                  <span key={t} className="key-badge">{t}</span>
                ))}
              </div>
            )}
            <h1 className="page-title leading-tight">{song.title}</h1>
            {song.artist && (
              <p className="mt-1" style={{ color: "var(--color-on-surface-variant)" }}>{song.artist}</p>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              <LearningBadge status={learningStatus} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <FavoriteToggle songId={song.id} initial={isFavorite} />
            <Link
              href={`/app/songs/${song.id}/read`}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}
              title="Mode lecture"
            >
              <Eye size={16} />
            </Link>
            {canEditSongs(session.user.role) && (
              <Link
                href={`/app/songs/${song.id}/edit`}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                style={{ border: "1px solid var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}
                title="Modifier"
              >
                <Pencil size={16} />
              </Link>
            )}
          </div>
        </div>

        {/* Learning status selector */}
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-outline-variant)" }}>
          <LearningSelect songId={song.id} initial={learningStatus} />
        </div>
      </div>

      <ScoresSection songId={song.id} initial={song.scores} canEdit={canEditSongs(session.user.role)} />

      {/* Blocks */}
      <div className="flex flex-col gap-6">
        {song.blocks.map((block, idx) => (
          <div key={block.id}>
            <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "var(--color-on-surface-variant)" }}>
              {blockTypeLabel[block.type] ?? block.type}
              {block.type === "VERSE" ? ` ${idx + 1}` : ""}
            </p>
            <div
              className="pl-4 text-[17px] leading-relaxed whitespace-pre-line"
              style={{ borderLeft: "2px solid var(--color-outline-variant)", color: "var(--color-on-surface)", fontFamily: "var(--font-sans)" }}
            >
              {block.content}
            </div>
          </div>
        ))}

        {song.blocks.length === 0 && (
          <div
            className="text-center py-8 rounded-xl"
            style={{ border: "1px dashed var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}
          >
            <Music size={24} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Aucun bloc de paroles.</p>
          </div>
        )}
      </div>
    </div>
  )
}
