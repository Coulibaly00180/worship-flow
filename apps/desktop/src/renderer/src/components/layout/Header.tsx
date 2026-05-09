import { useCallback, useState } from "react";
import { CalendarDays, ChevronDown, Circle, Copy, Keyboard, MoreHorizontal, Plus, Radio, Settings, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreatePlanDialog } from "@/components/dialogs/CreatePlanDialog";
import { useLive } from "@/hooks/useLive";
import { usePlan } from "@/hooks/usePlan";
import { cn } from "@/lib/utils";
import { localNowYmd, isoToYmd } from "@/lib/date";
import { parsePlanBackground, projectPlanItemToTarget } from "@/lib/projection";
import type { PlanItem, LiveState } from "@/lib/types";

interface HeaderProps {
  onOpenShortcuts?: () => void;
  onOpenSettings?: () => void;
}

function formatPlanDate(date: string | Date): string {
  const ymd = isoToYmd(String(date));
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-");
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  return dateObj.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatPlanLabel(plan: CpPlanListItem | { title?: string | null; date: string | Date } | undefined): string {
  if (!plan) return "Aucun plan";
  if (plan.title) return plan.title;
  return formatPlanDate(plan.date);
}

function isTodayPlan(plan: { date: string | Date } | undefined): boolean {
  if (!plan) return false;
  return isoToYmd(String(plan.date)) === localNowYmd();
}

export function Header({ onOpenShortcuts, onOpenSettings }: HeaderProps) {
  const { live, toggle, startFreeMode } = useLive();
  const { planList, selectedPlanId, plan, selectPlan, refreshList } = usePlan();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const isPlanMode = live?.enabled === true && live.planId !== null;
  const isFreeMode = live?.enabled === true && live.planId === null;
  const canStartPlanMode = isPlanMode || Boolean(selectedPlanId);

  // Mode Direct (plan) — binds a plan, resets cursor, auto-projects first item.
  const handlePlanModeToggle = useCallback(async () => {
    if (isPlanMode) {
      await toggle();
    } else {
      if (!selectedPlanId) return;
      const liveState = await window.cp.live.set({ planId: selectedPlanId ?? null, enabled: true, cursor: 0 });
      const firstItem = plan?.items[0];
      if (firstItem) {
        await projectPlanItemToTarget(
          liveState.target,
          firstItem as PlanItem,
          liveState as unknown as LiveState,
          parsePlanBackground(plan?.backgroundConfig)
        );
      }
    }
  }, [isPlanMode, toggle, selectedPlanId, plan]);

  // Mode Libre — plan-less projection for rehearsals / bible studies.
  // Auto-switches from Mode Direct if it was active.
  const handleFreeToggle = useCallback(async () => {
    if (isFreeMode) {
      await toggle();
    } else {
      await startFreeMode();
    }
  }, [isFreeMode, toggle, startFreeMode]);

  const handleDuplicate = useCallback(async () => {
    if (!selectedPlanId) return;
    const duplicated = await window.cp.plans.duplicate({ planId: selectedPlanId });
    if (duplicated) {
      await refreshList();
      selectPlan(duplicated.id);
      toast.success("Plan dupliqué");
    }
  }, [selectedPlanId, refreshList, selectPlan]);

  const statusLabel = isPlanMode ? "Mode Direct" : isFreeMode ? "Mode Libre" : "Preparation";
  const statusTone = isPlanMode
    ? "bg-live-indicator/15 text-live-indicator border-live-indicator/20"
    : isFreeMode
      ? "bg-warning/15 text-warning border-warning/20"
      : "bg-bg-surface text-text-secondary border-border";
  const statusHint = isPlanMode
    ? "Le plan selectionne est projete en direct."
    : isFreeMode
      ? "Projection libre sans plan lie au service."
      : plan
        ? "Pret a projeter ce plan quand vous le souhaitez."
        : "Selectionnez un plan avant de lancer le direct.";
  const utilityCount =
    (plan ? 1 : 0) +
    (onOpenShortcuts ? 1 : 0) +
    (onOpenSettings ? 1 : 0);

  return (
    <>
      <header
        className="flex items-center gap-3 px-4 border-b border-border bg-bg-surface shrink-0 h-[var(--header-height)]"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0 rounded-xl border border-border bg-bg-elevated/40 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Video className="h-4 w-4" />
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted leading-none mb-0.5">
              Regie
            </p>
            <p className="text-sm font-semibold text-text-primary leading-none">Church Presenter</p>
          </div>
        </div>

        {/* Séparateur vertical */}
        <div className="h-8 w-px bg-border shrink-0" />

        {/* Plan selector */}
        <div className="min-w-0 shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted leading-none mb-1">
            Plan actif
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-[260px] justify-between rounded-xl border border-border bg-bg-elevated/30 px-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                  <span className="truncate text-sm font-medium text-text-primary">
                    {plan ? formatPlanLabel(plan) : "Aucun plan"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-1">
                  {plan && isTodayPlan(plan) && (
                    <Badge variant="success" className="px-1.5 py-0 text-[10px]">
                      Auj.
                    </Badge>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
                </div>
              </Button>
            </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-80">
                <DropdownMenuLabel className="text-xs">Plans de culte</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {planList.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-text-muted">
                    Aucun plan disponible
                  </div>
                ) : (
                  planList.map((p) => {
                    const isSelected = selectedPlanId === p.id;
                    const isToday = isTodayPlan(p);
                    return (
                      <DropdownMenuItem
                        key={p.id}
                        className={cn(isSelected && "bg-bg-elevated font-medium")}
                        onClick={() => selectPlan(p.id)}
                      >
                        <CalendarDays className="h-3.5 w-3.5 text-text-muted shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-sm">{p.title ?? formatPlanDate(p.date)}</div>
                          <div className="truncate text-xs text-text-muted">{formatPlanDate(p.date)}</div>
                        </div>
                        {isToday && (
                          <Badge variant="success" className="px-1.5 py-0 text-xs">
                            Auj.
                          </Badge>
                        )}
                        {isSelected && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-hidden />
                        )}
                      </DropdownMenuItem>
                    );
                  })
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Nouveau plan…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>

        {/* Séparateur vertical */}
        <div className="h-8 w-px bg-border shrink-0" />

        {/* Center: statut + commandes de projection */}
        <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
          {/* Statut */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                statusTone,
              )}
            >
              <Circle className={cn("h-2 w-2", (isPlanMode || isFreeMode) && "fill-current animate-pulse")} />
              {statusLabel}
            </span>
            <p className="truncate text-xs text-text-muted hidden lg:block">
              {statusHint}
            </p>
          </div>

          {/* Boutons d'action */}
          <div className="flex shrink-0 items-center gap-2">
            {isPlanMode ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void handlePlanModeToggle()}
                className="gap-1.5 rounded-xl px-4"
                aria-label="Quitter le mode Direct"
              >
                <Circle className="h-2 w-2 fill-current animate-pulse" />
                Quitter le Direct
              </Button>
            ) : isFreeMode ? (
              <Button
                size="sm"
                onClick={() => void handleFreeToggle()}
                className="gap-1.5 rounded-xl border-warning bg-warning px-4 text-white hover:bg-warning/90"
                aria-label="Quitter le mode Libre"
              >
                <Circle className="h-2 w-2 fill-current animate-pulse" />
                Quitter le Mode Libre
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={() => void handlePlanModeToggle()}
                  disabled={!canStartPlanMode}
                  className="gap-1.5 rounded-xl bg-success px-4 text-white hover:bg-success/90"
                  aria-label="Entrer en mode Direct"
                  title={!canStartPlanMode ? "Selectionnez un plan pour lancer le direct" : undefined}
                >
                  <Video className="h-3.5 w-3.5" />
                  Entrer en mode Direct
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleFreeToggle()}
                  className="gap-1.5 rounded-xl px-4"
                  aria-label="Passer en mode Libre"
                >
                  <Radio className="h-3.5 w-3.5" />
                  Mode Libre
                </Button>
              </>
            )}

            {/* Menu utilitaires */}
            {utilityCount > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Outils du plan et reglages"
                    className="h-9 w-9 rounded-xl border border-border bg-bg-elevated/30"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="text-xs">Outils</DropdownMenuLabel>
                  {plan && (
                    <>
                      <DropdownMenuItem onClick={() => void handleDuplicate()}>
                        <Copy className="h-3.5 w-3.5" />
                        Dupliquer ce plan
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {onOpenShortcuts && (
                    <DropdownMenuItem onClick={onOpenShortcuts}>
                      <Keyboard className="h-3.5 w-3.5" />
                      Raccourcis clavier
                    </DropdownMenuItem>
                  )}
                  {onOpenSettings && (
                    <DropdownMenuItem onClick={onOpenSettings}>
                      <Settings className="h-3.5 w-3.5" />
                      Parametres
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      <CreatePlanDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
    </>
  );
}
