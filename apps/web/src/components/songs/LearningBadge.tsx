import { CheckCircle2, Clock, BookOpen } from "lucide-react"

type LearningStatus = "TO_LEARN" | "IN_PROGRESS" | "MASTERED" | null

const config: Record<NonNullable<LearningStatus>, { label: string; cls: string; Icon: React.ElementType }> = {
  MASTERED:    { label: "Maîtrisé",    cls: "badge badge-mastered", Icon: CheckCircle2 },
  IN_PROGRESS: { label: "En cours",    cls: "badge badge-progress", Icon: Clock },
  TO_LEARN:    { label: "À apprendre", cls: "badge badge-learn",    Icon: BookOpen },
}

/** Pastille de statut : icône + texte (le statut ne repose jamais sur la couleur seule). */
export function LearningBadge({ status }: { status: LearningStatus }) {
  if (!status) return null
  const { label, cls, Icon } = config[status]
  return (
    <span className={cls}>
      <Icon size={13} aria-hidden="true" />
      {label}
    </span>
  )
}
