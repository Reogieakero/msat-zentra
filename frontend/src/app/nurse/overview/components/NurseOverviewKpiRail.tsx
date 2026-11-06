"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Send,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { NurseKpis, NurseQueueRow } from "@/services/nurse/nurse.types";
import { waitingElapsed } from "./nurse-action-badge";
import { useNowMs } from "./use-now-ms";
import styles from "./nurse-overview.module.css";

// Flyout panel — same look as the registry KPI rails: solid surface, shadow
// + ring, smooth open/close. Anchored left of the rail icon.
const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

// Needs-review flyout previews the longest-waiting cases before the CTA.
const NEEDS_PREVIEW_LIMIT = 5;

type KpiKey = "needs" | "booked" | "endorsed" | "followup" | "done";

interface KpiAction {
  key: KpiKey;
  icon: LucideIcon;
  title: string;
  count: number;
  href: string;
  hint: string;
  cta: string;
  description: string;
  accent: string;
}

function GutterIconButton({
  label,
  expanded,
  onToggle,
  children,
  ref,
  ...triggerProps
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
} & Omit<React.ComponentPropsWithoutRef<"button">, "onClick" | "aria-label">) {
  return (
    <button
      ref={ref}
      type="button"
      {...triggerProps}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      aria-label={expanded ? `Close ${label}` : `Open ${label}`}
      className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
        expanded
          ? "cursor-pointer border-amber-500/60 bg-amber-500/10"
          : "cursor-pointer border-border bg-card hover:border-amber-500/60 hover:bg-amber-500/10"
      }`}
    >
      {children}
    </button>
  );
}

function GutterTip({ title, hint }: { title: string; hint: string }) {
  return (
    <>
      <span className="font-medium">{title}</span>
      <span className="opacity-60">{hint}</span>
    </>
  );
}

/**
 * Icon-only right rail for /nurse/overview — one icon per clinic KPI queue,
 * same tooltip + flyout interaction as the registrar / record-keeper KPI
 * rail. Counts are the real overview KPIs, so the badges track the snapshot
 * numbers; clicking an icon opens a kanban board flyout with the queue
 * summary (and the longest-waiting cases for "Needs review").
 */
export function NurseOverviewKpiRail({
  kpis,
  needsReview,
}: {
  kpis: NurseKpis;
  needsReview: NurseQueueRow[];
}) {
  const [openKey, setOpenKey] = React.useState<KpiKey | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);
  const nowMs = useNowMs();

  React.useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      // Portaled tooltips live outside the rail — interacting with them
      // must not dismiss the open panel.
      if (
        target?.closest?.(
          '[data-slot="popover-content"], [data-slot="tooltip-content"]',
        )
      ) {
        return;
      }
      if (railRef.current && !railRef.current.contains(e.target as Node)) {
        setOpenKey(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenKey(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openKey]);

  const toggle = (key: KpiKey) => setOpenKey((prev) => (prev === key ? null : key));
  const close = () => setOpenKey(null);
  const panel = (key: KpiKey) =>
    `${MENU_PANEL} ${styles.railMenu} ${
      openKey === key ? styles.railMenuOpen : styles.railMenuClosed
    }`;

  const items: KpiAction[] = [
    {
      key: "needs",
      icon: Stethoscope,
      title: "Needs review",
      count: kpis.needsReview,
      href: "/nurse/alerts",
      hint: "Longest waiting first",
      cta: "Open queue",
      description: "Pending cases routed to the clinic, longest waiting first.",
      accent: "text-primary",
    },
    {
      key: "booked",
      icon: CalendarClock,
      title: "Booked session",
      count: kpis.bookedSession,
      href: "/nurse/referrals/clinic",
      hint: "Cases with an active booking",
      cta: "Open clinic queue",
      description: "Clinic cases with a session already on the calendar.",
      accent: "text-blue-500",
    },
    {
      key: "endorsed",
      icon: Send,
      title: "Endorsed to ADM coordinator",
      count: kpis.endorsedToAdm,
      href: "/nurse/referrals/adm",
      hint: "Sent to the coordinator",
      cta: "Open ADM cases",
      description: "Cases endorsed to the ADM coordinator for the parent meeting.",
      accent: "text-amber-500",
    },
    {
      key: "followup",
      icon: Activity,
      title: "Follow-up",
      count: kpis.followUp,
      href: "/nurse/alerts",
      hint: "Awaiting follow-up",
      cta: "Review follow-ups",
      description: "Cases the clinic is still following up on.",
      accent: "text-orange-500",
    },
    {
      key: "done",
      icon: CheckCircle2,
      title: "Done session",
      count: kpis.doneSession,
      href: "/nurse/referrals/clinic",
      hint: "Cases with a completed session",
      cta: "Open clinic queue",
      description: "Cases with at least one completed clinic session.",
      accent: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  const needsPreview = needsReview.slice(0, NEEDS_PREVIEW_LIMIT);

  return (
    <TooltipProvider delayDuration={100}>
      <aside className="self-start lg:sticky lg:top-16" aria-label="Clinic KPI actions">
        <div
          ref={railRef}
          className="flex flex-row justify-end gap-2 lg:flex-col lg:items-end"
        >
          {items.map((a) => {
            const Icon = a.icon;
            const opened = openKey === a.key;
            const showBadge = a.count > 0;
            const tip = a.count > 0 ? `${a.count} pending` : "All caught up";
            return (
              <div key={a.key} className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <GutterIconButton
                      label={a.title}
                      expanded={opened}
                      onToggle={() => toggle(a.key)}
                    >
                      <span className={a.accent} aria-hidden>
                        <Icon size={16} />
                      </span>
                      {showBadge ? (
                        <span
                          className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black"
                          aria-hidden="true"
                        >
                          {a.count}
                        </span>
                      ) : null}
                    </GutterIconButton>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={10}>
                    <GutterTip title={a.title} hint={tip} />
                  </TooltipContent>
                </Tooltip>
                <div
                  role="dialog"
                  aria-label={a.title}
                  aria-hidden={opened ? undefined : true}
                  className={panel(a.key)}
                >
                  <KanbanBoard
                    title={a.title}
                    icon={
                      <span className={a.accent} aria-hidden>
                        <Icon size={14} />
                      </span>
                    }
                    count={a.count}
                    description={a.description}
                    className="border-0"
                    footer={
                      <div className="flex justify-end gap-1.5 px-1 pb-1">
                        <Button asChild size="sm" className="h-6 px-2 text-xs">
                          <Link
                            href={a.href}
                            aria-label={
                              a.count === 0
                                ? `${a.title}: all caught up — ${a.cta}`
                                : `${a.title}: ${a.count} pending — ${a.cta}`
                            }
                            onClick={close}
                          >
                            {a.cta}
                            <ArrowRight size={14} aria-hidden />
                          </Link>
                        </Button>
                      </div>
                    }
                  >
                    {a.key === "needs" && needsPreview.length > 0 ? (
                      <ul className={styles.railCaseList}>
                        {needsPreview.map((row) => {
                          const homeBase =
                            row.type === "ADM"
                              ? "/nurse/referrals/adm"
                              : "/nurse/referrals/clinic";
                          return (
                            <li key={row.id}>
                              <Link
                                href={`${homeBase}?highlight=${row.id}`}
                                className={styles.railCaseItem}
                                onClick={close}
                              >
                                <span className={styles.railCaseName} title={row.student}>
                                  {row.student}
                                </span>
                                <span className={styles.railCaseWait}>
                                  {waitingElapsed(row.referredAt, nowMs)}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="flex-1 px-1 text-xs text-muted-foreground">
                        {a.key === "needs" ? "All caught up — nothing waiting for review." : a.hint}
                      </p>
                    )}
                  </KanbanBoard>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </TooltipProvider>
  );
}
