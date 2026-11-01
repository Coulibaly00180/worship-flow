import Link from "next/link"
import { CalendarDays, Plus, ChevronRight } from "lucide-react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { canManagePlans } from "@/lib/roles"

export const metadata = { title: "Plans de service" }

type PlanSummary = { id: string; date: Date; title: string | null; _count: { items: number } }

function longDate(d: Date) {
  return new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}

/** Ligne d'un plan : bloc date (jour / mois) + titre + nombre d'éléments. */
function PlanRow({ plan, highlight }: { plan: PlanSummary; highlight?: boolean }) {
  const d = new Date(plan.date)
  const count = plan._count.items
  return (
    <Link
      href={`/app/plans/${plan.id}`}
      className="flex items-center gap-4 px-4 rounded-[var(--radius-xl)]"
      style={{
        minHeight: 76,
        background: highlight ? "var(--color-primary-container)" : "var(--color-surface)",
        border: `1px solid ${highlight ? "var(--color-primary)" : "var(--color-outline-variant)"}`,
        boxShadow: "var(--shadow-sm)",
        textDecoration: "none",
      }}
    >
      <div
        className="grid place-items-center shrink-0 rounded-xl text-center"
        style={{
          width: 56,
          height: 60,
          background: highlight ? "var(--color-primary)" : "var(--color-surface-high)",
          color: highlight ? "var(--color-on-primary)" : "var(--color-on-surface)",
        }}
        aria-hidden="true"
      >
        <span className="leading-none">
          <span className="block text-2xl font-bold">{d.getDate()}</span>
          <span className="block text-xs font-bold uppercase mt-0.5">{d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}</span>
        </span>
      </div>

      <div className="flex-1 min-w-0 py-3">
        <p className="font-bold text-lg truncate" style={{ color: "var(--color-on-surface)" }}>
          {plan.title ?? <span className="first-cap">{d.toLocaleDateString("fr-FR", { weekday: "long" })}</span>}
        </p>
        <p className="text-sm first-cap" style={{ color: highlight ? "var(--color-on-primary-container)" : "var(--color-on-surface-variant)" }}>
          {longDate(plan.date)} · {count} élément{count > 1 ? "s" : ""}
        </p>
      </div>

      {highlight && <span className="badge badge-progress shrink-0 hidden sm:inline-flex">Prochain</span>}
      <ChevronRight size={20} className="shrink-0" style={{ color: "var(--color-on-surface-variant)" }} aria-hidden="true" />
    </Link>
  )
}

export default async function PlansPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const plans = await prisma.servicePlan.findMany({
    where: { deletedAt: null },
    orderBy: { date: "desc" },
    include: { _count: { select: { items: true } } },
  })

  // Un plan reste « à venir » toute sa journée
  const since = new Date()
  since.setHours(since.getHours() - 12)
  const upcoming = plans.filter((p) => new Date(p.date) >= since).reverse() // du plus proche au plus lointain
  const past = plans.filter((p) => new Date(p.date) < since)
  const canPlan = canManagePlans(session.user.role)

  return (
    <div className="page-container" style={{ maxWidth: 860 }}>
      <div className="page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Plans de service</h1>
          <p className="page-subtitle">
            {upcoming.length > 0 ? `${upcoming.length} à venir` : "Aucun service à venir"}
            {past.length > 0 ? ` · ${past.length} passé${past.length > 1 ? "s" : ""}` : ""}
          </p>
        </div>
        {canPlan && (
          <Link href="/app/plans/new" className="btn btn-primary">
            <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
            Nouveau plan
          </Link>
        )}
      </div>

      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 gap-3" style={{ color: "var(--color-on-surface-variant)" }}>
          <CalendarDays size={44} strokeWidth={1.25} style={{ color: "var(--color-outline)" }} aria-hidden="true" />
          <p className="text-lg font-bold" style={{ color: "var(--color-on-surface)" }}>Aucun plan de service</p>
          <p className="max-w-sm">
            {canPlan ? "Créez le plan du prochain culte : ordre des chants, notes et lecteurs." : "Le plan du prochain service apparaîtra ici dès qu'il sera publié."}
          </p>
          {canPlan && (
            <Link href="/app/plans/new" className="btn btn-primary mt-2">
              <Plus size={18} aria-hidden="true" /> Créer le premier plan
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {upcoming.length > 0 && (
            <section aria-labelledby="upcoming">
              <h2 id="upcoming" className="text-xl font-bold mb-3">À venir</h2>
              <ul className="flex flex-col gap-3">
                {upcoming.map((p, i) => (
                  <li key={p.id}><PlanRow plan={p} highlight={i === 0} /></li>
                ))}
              </ul>
            </section>
          )}

          {past.length > 0 && (
            <section aria-labelledby="past">
              <details open={upcoming.length === 0}>
                <summary
                  id="past"
                  className="text-xl font-bold mb-3 cursor-pointer flex items-center gap-2"
                  style={{ minHeight: 44, fontFamily: "var(--font-serif)" }}
                >
                  Services passés <span className="text-base font-semibold" style={{ color: "var(--color-on-surface-variant)" }}>({past.length})</span>
                </summary>
                <ul className="flex flex-col gap-3 mt-3">
                  {past.map((p) => (
                    <li key={p.id}><PlanRow plan={p} /></li>
                  ))}
                </ul>
              </details>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
