import Link from "next/link"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { canManagePlans } from "@/lib/roles"
import { Music2, CalendarDays, Heart, CheckCircle2, Clock, ArrowRight, ChevronRight, BookOpen } from "lucide-react"

export const metadata = { title: "Accueil" }

const STATUS_LABEL: Record<string, string> = { TO_LEARN: "À apprendre", IN_PROGRESS: "En cours" }

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const userId = session.user.id
  // Un plan reste « prochain » toute sa journée (et 12 h après son début)
  const since = new Date()
  since.setHours(since.getHours() - 12)

  const [songsCount, favoritesCount, learningStats, nextPlan, toWork, favoriteSongs] = await Promise.all([
    prisma.song.count({ where: { deletedAt: null } }),
    prisma.favorite.count({ where: { userId } }),
    prisma.songLearning.groupBy({ by: ["status"], where: { userId }, _count: { status: true } }),
    prisma.servicePlan.findFirst({
      where: { date: { gte: since }, deletedAt: null },
      orderBy: { date: "asc" },
      include: {
        items: {
          where: { kind: "SONG_BLOCK" },
          orderBy: { order: "asc" },
          take: 8,
          include: { song: { select: { id: true, title: true } } },
        },
      },
    }),
    prisma.songLearning.findMany({
      where: { userId, status: { in: ["TO_LEARN", "IN_PROGRESS"] }, song: { deletedAt: null } },
      orderBy: { updatedAt: "desc" },
      take: 4,
      include: { song: { select: { id: true, title: true, artist: true } } },
    }),
    prisma.favorite.findMany({
      where: { userId, song: { deletedAt: null } },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { song: { select: { id: true, title: true, artist: true } } },
    }),
  ])

  const mastered = learningStats.find((s) => s.status === "MASTERED")?._count.status ?? 0
  const inProgress = learningStats.find((s) => s.status === "IN_PROGRESS")?._count.status ?? 0
  const toLearn = learningStats.find((s) => s.status === "TO_LEARN")?._count.status ?? 0
  const totalLearning = mastered + inProgress + toLearn
  const pct = (n: number) => (totalLearning > 0 ? Math.round((n / totalLearning) * 100) : 0)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir"
  const firstName = session.user.firstName || session.user.name?.split(" ")[0] || ""
  const canPlan = canManagePlans(session.user.role)

  const planDate = nextPlan
    ? new Date(nextPlan.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
    : null

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
        <p className="page-subtitle">Ce qui vous attend cette semaine.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Prochain service */}
        <section
          aria-labelledby="next-service"
          className="lg:col-span-3 rounded-[var(--radius-xl)] p-5 sm:p-6"
          style={{ background: "var(--color-primary-container)", color: "var(--color-on-primary-container)" }}
        >
          <p className="eyebrow" style={{ color: "inherit", opacity: 0.85 }} id="next-service">
            <CalendarDays size={14} aria-hidden="true" /> Prochain service
          </p>

          {nextPlan ? (
            <>
              <h2 className="text-2xl sm:text-3xl font-bold first-cap" style={{ color: "inherit" }}>
                {nextPlan.title ?? planDate}
              </h2>
              {nextPlan.title && <p className="mt-1 first-cap opacity-90">{planDate}</p>}

              {nextPlan.items.length > 0 ? (
                <ol className="mt-5 flex flex-col gap-2">
                  {nextPlan.items.map((item, i) => {
                    const label = item.title ?? item.song?.title ?? "Chant"
                    const row = (
                      <>
                        <span
                          className="w-8 h-8 rounded-full text-sm font-bold grid place-items-center shrink-0"
                          style={{ background: "var(--color-primary)", color: "var(--color-on-primary)" }}
                          aria-hidden="true"
                        >
                          {i + 1}
                        </span>
                        <span className="font-semibold truncate flex-1">{label}</span>
                        {item.song && <ChevronRight size={18} aria-hidden="true" />}
                      </>
                    )
                    return (
                      <li key={item.id}>
                        {item.song ? (
                          <Link
                            href={`/app/songs/${item.song.id}`}
                            className="flex items-center gap-3 px-3 rounded-xl"
                            style={{ minHeight: 52, background: "var(--color-surface)", color: "var(--color-on-surface)" }}
                          >
                            {row}
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3 px-3 rounded-xl" style={{ minHeight: 52, background: "var(--color-surface)", color: "var(--color-on-surface)" }}>
                            {row}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <p className="mt-4 opacity-90">Aucun chant dans ce plan pour l&apos;instant.</p>
              )}

              <Link href={`/app/plans/${nextPlan.id}`} className="btn btn-primary mt-5">
                Voir le plan complet <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold" style={{ color: "inherit" }}>Aucun service prévu</h2>
              <p className="mt-2 opacity-90">
                {canPlan ? "Préparez le prochain plan de service." : "Le plan du prochain service apparaîtra ici dès qu'il sera publié."}
              </p>
              {canPlan && (
                <Link href="/app/plans/new" className="btn btn-primary mt-5">
                  Créer un plan <ArrowRight size={17} aria-hidden="true" />
                </Link>
              )}
            </>
          )}
        </section>

        {/* Colonne de droite */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* À travailler */}
          <section className="card" aria-labelledby="to-work">
            <div className="flex items-center justify-between mb-3">
              <h2 id="to-work" className="text-lg font-bold">À travailler</h2>
              <Link href="/app/songs?status=IN_PROGRESS" className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>
                Voir tout
              </Link>
            </div>
            {toWork.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-on-surface-variant)" }}>
                Marquez un chant « À apprendre » depuis sa fiche : il apparaîtra ici.
              </p>
            ) : (
              <ul className="flex flex-col">
                {toWork.map(({ song, status }) => (
                  <li key={song.id}>
                    <Link href={`/app/songs/${song.id}`} className="flex items-center gap-3 py-2.5 rounded-lg" style={{ minHeight: 48 }}>
                      <BookOpen size={18} style={{ color: "var(--color-secondary)" }} aria-hidden="true" />
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold truncate" style={{ color: "var(--color-on-surface)" }}>{song.title}</span>
                      </span>
                      <span className={`badge ${status === "IN_PROGRESS" ? "badge-progress" : "badge-learn"}`}>{STATUS_LABEL[status]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Progression */}
          <section className="card" aria-labelledby="progress">
            <h2 id="progress" className="text-lg font-bold mb-3">Ma progression</h2>
            {totalLearning === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-on-surface-variant)" }}>
                Indiquez où vous en êtes sur chaque chant pour suivre votre apprentissage.
              </p>
            ) : (
              <>
                <div
                  className="flex h-3 rounded-full overflow-hidden"
                  style={{ background: "var(--color-surface-high)" }}
                  role="img"
                  aria-label={`${mastered} maîtrisés, ${inProgress} en cours, ${toLearn} à apprendre`}
                >
                  <div style={{ width: `${pct(mastered)}%`, background: "var(--color-mastered)" }} />
                  <div style={{ width: `${pct(inProgress)}%`, background: "var(--color-progress)" }} />
                </div>
                <ul className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Maîtrisés", n: mastered, color: "var(--color-mastered)", Icon: CheckCircle2 },
                    { label: "En cours", n: inProgress, color: "var(--color-progress)", Icon: Clock },
                    { label: "À apprendre", n: toLearn, color: "var(--color-learn)", Icon: BookOpen },
                  ].map(({ label, n, color, Icon }) => (
                    <li key={label} className="rounded-xl py-2" style={{ background: "var(--color-surface-low)" }}>
                      <Icon size={18} className="mx-auto" style={{ color }} aria-hidden="true" />
                      <p className="text-2xl font-bold leading-tight" style={{ color: "var(--color-on-surface)" }}>{n}</p>
                      <p className="text-xs font-semibold" style={{ color: "var(--color-on-surface-variant)" }}>{label}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>

      {/* Favoris */}
      <section className="mt-6 card" aria-labelledby="favs">
        <div className="flex items-center justify-between mb-3">
          <h2 id="favs" className="text-lg font-bold flex items-center gap-2">
            <Heart size={18} style={{ color: "var(--color-primary)" }} aria-hidden="true" /> Mes favoris
            <span className="text-sm font-semibold" style={{ color: "var(--color-on-surface-variant)" }}>({favoritesCount})</span>
          </h2>
          <Link href="/app/favorites" className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>Voir tout</Link>
        </div>
        {favoriteSongs.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-on-surface-variant)" }}>
            Touchez le cœur sur un chant pour le retrouver ici. La bibliothèque compte {songsCount} chant{songsCount > 1 ? "s" : ""}.
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {favoriteSongs.map(({ song }) => (
              <li key={song.id}>
                <Link
                  href={`/app/songs/${song.id}`}
                  className="flex items-center gap-3 px-3 rounded-xl"
                  style={{ minHeight: 56, background: "var(--color-surface-low)" }}
                >
                  <Music2 size={18} style={{ color: "var(--color-secondary)" }} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-semibold truncate" style={{ color: "var(--color-on-surface)" }}>{song.title}</span>
                    {song.artist && <span className="block text-sm truncate" style={{ color: "var(--color-on-surface-variant)" }}>{song.artist}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
