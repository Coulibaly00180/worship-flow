import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, BookOpen, Pencil, Music } from "lucide-react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { FavoriteToggle } from "@/components/songs/FavoriteToggle"
import { LearningSelect } from "@/components/songs/LearningSelect"
import { OfflineButton } from "@/components/pwa/OfflineButton"
import { ScoresSection } from "@/components/songs/ScoresSection"
import { canEditSongs } from "@/lib/roles"

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const song = await prisma.song.findUnique({ where: { id }, select: { title: true } })
  return { title: song?.title ?? "Chant" }
}

const blockTypeLabel: Record<string, string> = {
  VERSE: "Couplet",
  CHORUS: "Refrain",
  BRIDGE: "Pont",
  INTRO: "Intro",
  OUTRO: "Final",
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
      scores: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true, kind: true, voice: true, filename: true, mimeType: true, size: true, abc: true, source: true },
      },
    },
  })

  if (!song || song.deletedAt) notFound()

  const isFavorite = song.favorites.length > 0
  const learningStatus = song.learnings[0]?.status ?? null
  const canEdit = canEditSongs(session.user.role)
  const tags = song.tags

  // Numérotation des couplets : 1, 2, 3… (et non leur rang parmi tous les blocs)
  const labelled = song.blocks.map((b, i) => {
    const base = blockTypeLabel[b.type] ?? b.type
    const verseNo = song.blocks.slice(0, i + 1).filter((x) => x.type === "VERSE").length
    return { ...b, label: b.type === "VERSE" ? `${base} ${verseNo}` : base }
  })

  return (
    <div className="page-container" style={{ maxWidth: 820 }}>
      <Link
        href="/app/songs"
        className="inline-flex items-center gap-2 text-base font-semibold mb-5 print:hidden"
        style={{ color: "var(--color-on-surface-variant)", minHeight: 44 }}
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Tous les chants
      </Link>

      {/* En-tête */}
      <header className="card mb-6">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.map((t) => (
              <Link key={t} href={`/app/songs?tag=${encodeURIComponent(t)}`} className="key-badge" style={{ textDecoration: "none" }}>{t}</Link>
            ))}
          </div>
        )}
        <h1 className="page-title">{song.title}</h1>
        {song.artist && (
          <p className="mt-1 text-lg" style={{ color: "var(--color-on-surface-variant)" }}>{song.artist}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-5 print:hidden">
          <Link href={`/app/songs/${song.id}/read`} className="btn btn-primary btn-lg">
            <BookOpen size={20} aria-hidden="true" />
            Lire en mode scène
          </Link>
          <FavoriteToggle songId={song.id} initial={isFavorite} />
          {canEdit && (
            <Link href={`/app/songs/${song.id}/edit`} className="btn btn-secondary" aria-label="Modifier le chant">
              <Pencil size={17} aria-hidden="true" />
              <span className="hidden sm:inline">Modifier</span>
            </Link>
          )}
          <OfflineButton
            withAbc={song.scores.some((sc) => sc.kind !== "FILE")}
            urls={[
              `/app/songs/${song.id}`,
              `/app/songs/${song.id}/read`,
              ...song.scores.filter((sc) => sc.kind === "FILE").map((sc) => `/api/songs/${song.id}/scores/${sc.id}`),
            ]}
          />
        </div>

        <div className="mt-6 pt-5 print:hidden" style={{ borderTop: "1px solid var(--color-outline-variant)" }}>
          <h2 className="text-base font-bold mb-3" style={{ fontFamily: "var(--font-sans)" }}>Où j&apos;en suis sur ce chant</h2>
          <LearningSelect songId={song.id} initial={learningStatus} />
        </div>
      </header>

      <ScoresSection songId={song.id} songTitle={song.title} initial={song.scores} canEdit={canEdit} />

      {/* Paroles */}
      <section aria-labelledby="lyrics-title">
        <h2 id="lyrics-title" className="text-2xl font-bold mb-4">Paroles</h2>
        <div className="flex flex-col gap-5">
          {labelled.map((block) => (
            <article key={block.id} className="card" style={{ padding: "18px 20px" }}>
              <h3
                className="text-sm font-bold uppercase mb-2"
                style={{ color: "var(--color-secondary)", letterSpacing: "0.05em", fontFamily: "var(--font-sans)" }}
              >
                {block.label}
              </h3>
              <p className="whitespace-pre-line lyrics" style={{ fontSize: "1.1875rem", lineHeight: 1.75, color: "var(--color-on-surface)" }}>
                {block.content}
              </p>
            </article>
          ))}

          {song.blocks.length === 0 && (
            <div
              className="text-center py-10 rounded-xl"
              style={{ border: "2px dashed var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}
            >
              <Music size={28} className="mx-auto mb-2" aria-hidden="true" />
              <p>Aucune parole saisie pour ce chant.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
