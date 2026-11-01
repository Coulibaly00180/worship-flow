import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Pencil, Music2, BookOpen, Megaphone, Timer, ChevronRight, Clock } from "lucide-react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { PlanActions } from "@/components/plans/PlanActions"
import { OfflineButton } from "@/components/pwa/OfflineButton"
import { canManagePlans } from "@/lib/roles"

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const plan = await prisma.servicePlan.findUnique({ where: { id }, select: { title: true, date: true } })
  if (!plan) return { title: "Plan de service" }
  return { title: plan.title ?? new Date(plan.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) }
}

const KIND_ICON: Record<string, React.ElementType> = {
  SONG_BLOCK: Music2,
  BIBLE_VERSE: BookOpen,
  BIBLE_PASSAGE: BookOpen,
  ANNOUNCEMENT_TEXT: Megaphone,
  ANNOUNCEMENT_IMAGE: Megaphone,
  ANNOUNCEMENT_PDF: Megaphone,
  ANNOUNCEMENT_VIDEO: Megaphone,
  TIMER: Timer,
}

const KIND_LABEL: Record<string, string> = {
  SONG_BLOCK: "Chant",
  BIBLE_VERSE: "Verset",
  BIBLE_PASSAGE: "Passage",
  ANNOUNCEMENT_TEXT: "Annonce",
  ANNOUNCEMENT_IMAGE: "Image",
  ANNOUNCEMENT_PDF: "PDF",
  ANNOUNCEMENT_VIDEO: "Vidéo",
  VERSE_MANUAL: "Verset",
  TIMER: "Minuteur",
}

const DURATION_MIN: Record<string, number> = {
  SONG_BLOCK: 5,
  BIBLE_VERSE: 1,
  BIBLE_PASSAGE: 2,
  ANNOUNCEMENT_TEXT: 2,
  ANNOUNCEMENT_IMAGE: 2,
  ANNOUNCEMENT_PDF: 3,
  ANNOUNCEMENT_VIDEO: 3,
  VERSE_MANUAL: 1,
  TIMER: 0,
}

function formatDuration(min: number) {
  const m = Math.floor(min)
  const s = Math.round((min - m) * 60)
  return s > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${m} min`
}

function parseTags(tags: string | null): string[] {
  if (!tags) return []
  try {
    const arr = JSON.parse(tags)
    return Array.isArray(arr) ? arr.map(String) : []
  } catch { return [] }
}

export default async function PlanDetailPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect("/login")

  const { id } = await params

  const plan = await prisma.servicePlan.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: {
          song: { select: { id: true, title: true, tags: true, scores: { select: { id: true, kind: true } } } },
        },
      },
    },
  })

  if (!plan || plan.deletedAt) notFound()

  const canManage = canManagePlans(session.user.role)

  // Pages et fichiers à enregistrer pour consulter le plan sans réseau
  const offlineUrls = [
    `/app/plans/${plan.id}`,
    ...plan.items.flatMap((it) =>
      it.song
        ? [
            `/app/songs/${it.song.id}`,
            `/app/songs/${it.song.id}/read`,
            ...it.song.scores.filter((sc) => sc.kind === "FILE").map((sc) => `/api/songs/${it.song!.id}/scores/${sc.id}`),
          ]
        : [],
    ),
  ]

  const totalMinutes = plan.items.reduce((acc, item) => acc + (DURATION_MIN[item.kind] ?? 2), 0)

  const dateStr = new Date(plan.date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="page-container" style={{ maxWidth: 820 }}>
      <Link
        href="/app/plans"
        className="inline-flex items-center gap-2 text-base font-semibold mb-5 print:hidden"
        style={{ color: "var(--color-on-surface-variant)", minHeight: 44 }}
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Tous les plans
      </Link>

      <header className="mb-6">
        <p className="eyebrow">Plan de service</p>
        <h1 className="page-title first-cap">{plan.title ?? dateStr}</h1>
        {plan.title && (
          <p className="mt-1 text-lg first-cap" style={{ color: "var(--color-on-surface-variant)" }}>{dateStr}</p>
        )}

        <div className="flex flex-wrap items-start gap-2 mt-5 print:hidden">
          {canManage && (
            <Link href={`/app/plans/${plan.id}/edit`} className="btn btn-primary">
              <Pencil size={17} aria-hidden="true" />
              Modifier
            </Link>
          )}
          <PlanActions planId={plan.id} canManage={canManage} />
          <OfflineButton urls={offlineUrls} withAbc={plan.items.some((it) => it.song?.scores.some((sc) => sc.kind === "ABC"))} />
        </div>
      </header>

      <section aria-labelledby="order-title">
        <div className="flex items-end justify-between mb-3">
          <h2 id="order-title" className="text-2xl font-bold">Ordre du service</h2>
          <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--color-on-surface-variant)" }}>
            <Clock size={16} aria-hidden="true" />
            {formatDuration(totalMinutes)} environ
          </p>
        </div>

        {plan.items.length === 0 ? (
          <div
            className="py-12 text-center rounded-xl"
            style={{ border: "2px dashed var(--color-outline-variant)", color: "var(--color-on-surface-variant)" }}
          >
            Aucun élément dans ce plan.
          </div>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {plan.items.map((item, i) => {
              const Icon = KIND_ICON[item.kind] ?? Music2
              const isSong = item.kind === "SONG_BLOCK" && !!item.song
              const tags = parseTags(item.song?.tags ?? null)
              const title = item.title ?? item.song?.title ?? KIND_LABEL[item.kind] ?? "Élément"

              const body = (
                <>
                  <span
                    className="grid place-items-center shrink-0 rounded-full font-bold"
                    style={{
                      width: 36,
                      height: 36,
                      background: isSong ? "var(--color-primary)" : "var(--color-surface-high)",
                      color: isSong ? "var(--color-on-primary)" : "var(--color-on-surface-variant)",
                    }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>

                  <div className="flex-1 min-w-0 py-3">
                    <p className="font-bold text-lg leading-snug" style={{ color: "var(--color-on-surface)" }}>{title}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1 text-sm" style={{ color: "var(--color-on-surface-variant)" }}>
                        <Icon size={14} aria-hidden="true" />
                        {KIND_LABEL[item.kind] ?? item.kind}
                      </span>
                      {tags.slice(0, 2).map((t) => (
                        <span key={t} className="key-badge">{t}</span>
                      ))}
                    </div>
                    {item.notes && (
                      <p className="mt-1.5 text-base whitespace-pre-line" style={{ color: "var(--color-on-surface-variant)" }}>
                        {item.notes}
                      </p>
                    )}
                  </div>

                  {isSong && <ChevronRight size={20} className="shrink-0 print:hidden" style={{ color: "var(--color-on-surface-variant)" }} aria-hidden="true" />}
                </>
              )

              const cls = "flex items-center gap-3 px-3 rounded-[var(--radius-lg)]"
              const style = {
                minHeight: 64,
                background: "var(--color-surface)",
                border: "1px solid var(--color-outline-variant)",
                boxShadow: "var(--shadow-sm)",
                textDecoration: "none",
              } as const

              return (
                <li key={item.id}>
                  {isSong ? (
                    <Link href={`/app/songs/${item.song!.id}`} className={cls} style={style}>{body}</Link>
                  ) : (
                    <div className={cls} style={style}>{body}</div>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
