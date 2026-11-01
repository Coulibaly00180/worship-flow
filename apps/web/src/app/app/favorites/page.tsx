import Link from "next/link"
import { Heart, Search } from "lucide-react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { SongCard } from "@/components/songs/SongCard"

export const metadata = { title: "Favoris" }

type Props = {
  searchParams: Promise<{ q?: string; sort?: string }>
}

export default async function FavoritesPage({ searchParams }: Props) {
  const session = await auth()
  if (!session) redirect("/login")

  const { q = "", sort = "recent" } = await searchParams

  const favorites = await prisma.favorite.findMany({
    where: {
      userId: session.user.id,
      song: {
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { artist: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    },
    orderBy: sort === "title" ? { song: { title: "asc" } } : { createdAt: "desc" },
    include: {
      song: {
        include: {
          learnings: { where: { userId: session.user.id }, select: { status: true } },
          _count: { select: { scores: true } },
        },
      },
    },
  })

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Mes favoris</h1>
        <p className="page-subtitle">{favorites.length} chant{favorites.length > 1 ? "s" : ""} à portée de main</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <form method="GET" role="search" className="relative flex-1" style={{ minWidth: 240, maxWidth: 440 }}>
          <label htmlFor="fav-q" className="sr-only">Rechercher dans les favoris</label>
          <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-on-surface-variant)" }} aria-hidden="true" />
          <input
            id="fav-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Rechercher dans mes favoris…"
            className="input"
            style={{ paddingLeft: "46px", borderRadius: "var(--radius-full)", minHeight: 48 }}
          />
          {sort !== "recent" && <input type="hidden" name="sort" value={sort} />}
        </form>

        <div className="flex gap-2" role="group" aria-label="Trier">
          {[
            { value: "recent", label: "Récents" },
            { value: "title", label: "A → Z" },
          ].map(({ value, label }) => (
            <Link
              key={value}
              href={`/app/favorites?sort=${value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className="chip"
              data-active={sort === value}
              aria-pressed={sort === value}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 gap-3" style={{ color: "var(--color-on-surface-variant)" }}>
          <Heart size={44} strokeWidth={1.25} style={{ color: "var(--color-outline)" }} aria-hidden="true" />
          <p className="text-lg font-bold" style={{ color: "var(--color-on-surface)" }}>
            {q ? "Aucun favori ne correspond" : "Pas encore de favori"}
          </p>
          <p className="max-w-sm">
            {q ? "Essayez avec d'autres mots." : "Touchez le cœur sur la fiche d'un chant pour le retrouver ici, même hors-ligne une fois enregistré."}
          </p>
          {!q && (
            <Link href="/app/songs" className="btn btn-primary mt-2">Parcourir les chants</Link>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {favorites.map(({ song }) => (
            <li key={song.id} className="flex">
              <div className="w-full flex">
                <SongCard
                  id={song.id}
                  title={song.title}
                  artist={song.artist}
                  tags={song.tags}
                  isFavorite
                  hasScore={song._count.scores > 0}
                  learningStatus={song.learnings[0]?.status ?? null}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
