import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Pencil, Music2, BookOpen, Megaphone, Timer } from "lucide-react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { PlanActions } from "@/components/plans/PlanActions"
import { canManagePlans } from "@/lib/roles"

type Props = { params: Promise<{ id: string }> }

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
  return s > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${m}:00`
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
        include: { song: { select: { id: true, title: true, tags: true } } },
      },
    },
  })

  if (!plan || plan.deletedAt) notFound()

  const totalMinutes = plan.items.reduce((acc, item) => acc + (DURATION_MIN[item.kind] ?? 2), 0)

  const dateStr = new Date(plan.date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  function parseTags(tags: string | null): string[] {
    if (!tags) return []
    try {
      const arr = JSON.parse(tags)
      return Array.isArray(arr) ? arr.map(String) : []
    } catch { return [] }
  }

  return (
    <div className="page-container max-w-3xl">
      <Link
        href="/app/plans"
        className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors print:hidden"
        style={{ color: "var(--color-on-surface-variant)" }}
      >
        <ArrowLeft size={14} />
        Plans de service
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow">Plan de service</p>
          <h1 className="page-title capitalize">{plan.title ?? dateStr}</h1>
          {plan.title && (
            <p className="text-sm mt-1 capitalize" style={{ color: "var(--color-on-surface-variant)" }}>{dateStr}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {canManagePlans(session.user.role) && (
            <Link href={`/app/plans/${plan.id}/edit`} className="btn btn-secondary btn-sm mt-1 print:hidden">
              <Pencil size={14} />
              Modifier
            </Link>
          )}
          <PlanActions planId={plan.id} canManage={canManagePlans(session.user.role)} />
        </div>
      </div>

      {/* Items */}
      <div className="card-flat overflow-hidden mb-6" style={{ padding: 0, borderRadius: "var(--radius-xl)" }}>
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "1px solid var(--color-outline-variant)", background: "var(--color-surface-low)" }}
        >
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-on-surface-variant)" }}>
            Ordre du service
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-on-surface-variant)" }}>
            Durée
          </span>
        </div>

        {plan.items.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: "var(--color-on-surface-variant)" }}>
            Aucun élément dans ce plan.
          </div>
        ) : (
          plan.items.map((item) => {
            const Icon = KIND_ICON[item.kind] ?? Music2
            const isSong = item.kind === "SONG_BLOCK"
            const tags = parseTags(item.song?.tags ?? null)
            const dur = DURATION_MIN[item.kind] ?? 2

            return (
              <div
                key={item.id}
                className="flex items-center gap-4 px-5 py-4 transition-colors"
                style={{ borderBottom: "1px solid rgba(70,69,84,0.5)" }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: isSong ? "rgba(192,193,255,0.12)" : "rgba(255,255,255,0.05)",
                    color: isSong ? "var(--color-primary)" : "var(--color-on-surface-variant)",
                  }}
                >
                  <Icon size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--color-on-surface)" }}>
                    {item.title ?? item.song?.title ?? KIND_LABEL[item.kind]}
                  </p>
                  {item.notes && (
                    <p className="text-xs mt-0.5 whitespace-pre-line" style={{ color: "var(--color-on-surface-variant)" }}>
                      {item.notes}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    {tags.slice(0, 2).map((t) => (
                      <span key={t} className="key-badge">{t}</span>
                    ))}
                    {!isSong && (
                      <span className="text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
                        {KIND_LABEL[item.kind]}
                      </span>
                    )}
                  </div>
                </div>

                {isSong && item.song && (
                  <Link
                    href={`/app/songs/${item.song.id}`}
                    className="text-xs font-medium hover:underline shrink-0 print:hidden"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    Voir
                  </Link>
                )}

                <span className="text-sm font-semibold w-10 text-right shrink-0" style={{ color: "var(--color-on-surface-variant)" }}>
                  {formatDuration(dur)}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Total */}
      <div className="flex justify-end">
        <div className="card" style={{ textAlign: "right", display: "inline-block", minWidth: "160px" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--color-on-surface-variant)" }}>
            Durée totale estimée
          </p>
          <p className="text-3xl font-bold" style={{ color: "var(--color-primary)" }}>{formatDuration(totalMinutes)}</p>
        </div>
      </div>
    </div>
  )
}
