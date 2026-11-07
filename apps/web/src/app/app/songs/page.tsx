import Link from "next/link"
import { Plus, Search, Upload, Music2, Heart, Music, X, ChevronLeft, ChevronRight } from "lucide-react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { SongCard } from "@/components/songs/SongCard"
import { canEditSongs, canImportSongs } from "@/lib/roles"
import { SONG_PAGE_SIZE, buildSongQuery, findSongPage, parsePage } from "@/lib/songSearch"

export const metadata = { title: "Chants" }

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

type Params = { q?: string; letter?: string; status?: string; fav?: string; scores?: string; tag?: string; page?: string }
type Props = { searchParams: Promise<Params> }

const STATUS_CHIPS = [
  { value: "TO_LEARN", label: "À apprendre" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "MASTERED", label: "Maîtrisé" },
]

/** Construit un lien /app/songs en conservant les filtres actifs, avec des modifications. */
function href(current: Params, patch: Partial<Params>) {
  // Changer un filtre ramène à la première page (sauf si la page est explicitement demandée)
  const next: Record<string, string | undefined> = { ...current, page: undefined, ...patch }
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(next)) if (v) qs.set(k, v)
  const s = qs.toString()
  return s ? `/app/songs?${s}` : "/app/songs"
}

export default async function SongsPage({ searchParams }: Props) {
  const session = await auth()
  if (!session) redirect("/login")

  const params = await searchParams
  const { q = "", letter = "", status = "", fav = "", scores = "", tag = "" } = params
  const canEdit = canEditSongs(session.user.role)
  const canImport = canImportSongs(session.user.role)

  const { where, rank } = await buildSongQuery(session.user.id, {
    q, letter, status, tag, favorite: fav === "1", withScore: scores === "1",
  })
  const userId = session.user.id
  const { items: songs, meta } = await findSongPage(where, rank, parsePage(params.page), SONG_PAGE_SIZE, (args) =>
    prisma.song.findMany({
      ...args,
      include: {
        favorites: { where: { userId }, select: { userId: true } },
        learnings: { where: { userId }, select: { status: true } },
        _count: { select: { scores: true } },
      },
      orderBy: { title: "asc" },
    }),
  )
  const total = meta.total
  const filtered = !!(q || letter || status || fav || scores || tag)

  return (
    <div className="page-container">
      <div className="page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Chants</h1>
          <p className="page-subtitle" aria-live="polite">
            {filtered
              ? `${total} résultat${total > 1 ? "s" : ""}`
              : `${total} chant${total > 1 ? "s" : ""} dans la bibliothèque`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canImport && (
            <Link href="/app/songs/import" className="btn btn-secondary">
              <Upload size={17} aria-hidden="true" /> Importer
            </Link>
          )}
          {canEdit && (
            <Link href="/app/songs/new" className="btn btn-primary">
              <Plus size={18} strokeWidth={2.5} aria-hidden="true" /> Nouveau chant
            </Link>
          )}
        </div>
      </div>

      {/* Recherche : titre, artiste, étiquettes et paroles, sans tenir compte des accents */}
      <form method="GET" role="search" className="mb-4">
        <label htmlFor="song-q" className="sr-only">Rechercher un chant</label>
        <div className="relative" style={{ maxWidth: "560px" }}>
          <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-on-surface-variant)" }} aria-hidden="true" />
          <input
            id="song-q"
            name="q"
            type="search"
            defaultValue={q}
            enterKeyHint="search"
            placeholder="Titre, auteur ou paroles…"
            className="input"
            style={{ paddingLeft: "46px", borderRadius: "var(--radius-full)", minHeight: 48 }}
          />
        </div>
        {fav === "1" && <input type="hidden" name="fav" value="1" />}
        {scores === "1" && <input type="hidden" name="scores" value="1" />}
        {status && <input type="hidden" name="status" value={status} />}
        {tag && <input type="hidden" name="tag" value={tag} />}
      </form>

      {/* Filtres rapides */}
      <div className="scroll-x mb-4" style={{ gap: 8 }} role="group" aria-label="Filtres">
        <Link href={href(params, { fav: fav === "1" ? undefined : "1", letter: undefined })} className="chip" data-active={fav === "1"} aria-pressed={fav === "1"}>
          <Heart size={16} aria-hidden="true" /> Favoris
        </Link>
        <Link href={href(params, { scores: scores === "1" ? undefined : "1", letter: undefined })} className="chip" data-active={scores === "1"} aria-pressed={scores === "1"}>
          <Music size={16} aria-hidden="true" /> Avec partition
        </Link>
        {STATUS_CHIPS.map((c) => (
          <Link key={c.value} href={href(params, { status: status === c.value ? undefined : c.value, letter: undefined })} className="chip" data-active={status === c.value} aria-pressed={status === c.value}>
            {c.label}
          </Link>
        ))}
        {tag && (
          <Link href={href(params, { tag: undefined })} className="chip" data-active="true" aria-label={`Retirer le filtre ${tag}`}>
            {tag} <X size={14} aria-hidden="true" />
          </Link>
        )}
        {filtered && (
          <Link href="/app/songs" className="chip" style={{ borderStyle: "dashed" }}>
            Tout effacer
          </Link>
        )}
      </div>

      {/* Index alphabétique */}
      {!q && (
        <nav className="scroll-x mb-6" aria-label="Aller à la lettre">
          {ALPHABET.map((l) => (
            <Link key={l} href={href({ ...params, q: undefined }, { letter: letter === l ? undefined : l })} className="alpha-btn" data-active={letter === l ? "true" : "false"}>
              {l}
            </Link>
          ))}
        </nav>
      )}

      {songs.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 gap-3" style={{ color: "var(--color-on-surface-variant)" }}>
          <Music2 size={44} strokeWidth={1.25} style={{ color: "var(--color-outline)" }} aria-hidden="true" />
          <p className="text-lg font-bold" style={{ color: "var(--color-on-surface)" }}>
            {filtered ? "Aucun chant ne correspond" : "La bibliothèque est vide"}
          </p>
          <p className="max-w-sm">
            {filtered
              ? "Essayez d'autres mots (les accents ne comptent pas) ou retirez un filtre."
              : canEdit ? "Ajoutez un premier chant ou importez-en plusieurs d'un coup." : "Votre responsable chantre n'a pas encore ajouté de chants."}
          </p>
          {filtered ? (
            <Link href="/app/songs" className="btn btn-secondary mt-2">Tout effacer</Link>
          ) : canEdit ? (
            <Link href="/app/songs/new" className="btn btn-primary mt-2"><Plus size={18} aria-hidden="true" /> Ajouter un chant</Link>
          ) : null}
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {songs.map((song) => (
            <li key={song.id} className="flex">
              <div className="w-full flex">
                <SongCard
                  id={song.id}
                  title={song.title}
                  artist={song.artist}
                  tags={song.tags}
                  isFavorite={song.favorites.length > 0}
                  hasScore={song._count.scores > 0}
                  learningStatus={song.learnings[0]?.status ?? null}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {meta.pageCount > 1 && (
        <nav className="flex items-center justify-center gap-3 mt-6" aria-label="Pages">
          {meta.page > 1 ? (
            <Link href={href(params, { page: String(meta.page - 1) })} className="btn btn-secondary btn-sm" rel="prev">
              <ChevronLeft size={16} aria-hidden="true" /> Précédent
            </Link>
          ) : <span />}
          <span className="text-sm" style={{ color: "var(--color-on-surface-variant)" }} aria-current="page">
            Page {meta.page} / {meta.pageCount}
          </span>
          {meta.page < meta.pageCount ? (
            <Link href={href(params, { page: String(meta.page + 1) })} className="btn btn-secondary btn-sm" rel="next">
              Suivant <ChevronRight size={16} aria-hidden="true" />
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  )
}
