"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  HeartPulse,
  Inbox,
  MessageSquare,
  Send,
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
import type {
  GuidanceKpis,
  GuidanceReferralRow,
} from "@/services/guidance/overview.types";
import { STATUS_BADGE_LABELS } from "@/lib/labels/referral-status";
import styles from "./guidance-overview.module.css";

// Flyout panel — same look as the nurse / registry KPI rails: solid surface,
// shadow + ring, smooth open/close. Anchored left of the rail icon.
const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

// Referred-to-me flyout previews the latest cases before the CTA.
const PREVIEW_LIMIT = 5;

// Status wording + tone: labels start uppercase and the text color follows the
// status meaning (escalated = red, resolved = green, pending = amber, …).
const STATUS_TONE: Record<string, string> = {
  escalated: "font-semibold text-red-600 dark:text-red-400",
  dismissed: "text-red-600 dark:text-red-400",
  resolved: "text-green-600 dark:text-green-400",
  in_progress: "text-blue-600 dark:text-blue-400",
  pending: "text-amber-600 dark:text-amber-400",
  follow_up: "text-orange-600 dark:text-orange-400",
  info_requested: "text-violet-600 dark:text-violet-400",
};

function statusText(status: string): string {
  if (STATUS_BADGE_LABELS[status]) return STATUS_BADGE_LABELS[status];
  return status
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type KpiKey = "referred" | "interventions" | "highrisk" | "counseling" | "handoffs";

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
 * Icon-only right rail for /guidance/overview — one icon per guidance KPI
 * queue, same tooltip + flyout interaction as the nurse KPI rail. Counts are
 * the real overview KPIs; clicking an icon opens a kanban board flyout with
 * the queue summary (and the latest cases for "Referred to me").
 */
export function GuidanceOverviewKpiRail({
  kpis,
  referralsQueue,
}: {
  kpis: GuidanceKpis;
  referralsQueue?: GuidanceReferralRow[];
}) {
  const [openKey, setOpenKey] = React.useState<KpiKey | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);

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

  const toggle = (key: KpiKey) =>
    setOpenKey((prev) => (prev === key ? null : key));
  const close = () => setOpenKey(null);
  const panel = (key: KpiKey) =>
    `${MENU_PANEL} ${styles.railMenu} ${
      openKey === key ? styles.railMenuOpen : styles.railMenuClosed
    }`;

  const items: KpiAction[] = [
    {
      key: "referred",
      icon: Inbox,
      title: "Referred to me",
      count: kpis.referredToMe,
      href: "/guidance/referrals",
      hint: `ADM ${kpis.pendingAdm} · Counseling ${kpis.pendingCounseling}`,
      cta: "Open referrals",
      description: "Cases routed to the guidance desk, newest referral first.",
      accent: "text-primary",
    },
    {
      key: "interventions",
      icon: ClipboardList,
      title: "Open interventions",
      count: kpis.openInterventions,
      href: "/guidance/interventions",
      hint: `${kpis.myInterventions} assigned to me`,
      cta: "Open interventions",
      description: "Interventions still open, including the ones assigned to you.",
      accent: "text-amber-500",
    },
    {
      key: "highrisk",
      icon: HeartPulse,
      title: "High-risk students",
      count: kpis.highRisk,
      href: "/guidance/adm",
      hint: "Live recompute, active term",
      cta: "Open risk watch",
      description: "Students tripping two or more risk flags this term.",
      accent: "text-red-500",
    },
    {
      key: "counseling",
      icon: MessageSquare,
      title: "Pending counseling",
      count: kpis.pendingCounseling,
      href: "/guidance/referrals/counseling",
      hint: "Counseling cases awaiting action",
      cta: "Open counseling queue",
      description: "Counseling cases still awaiting a session or resolution.",
      accent: "text-blue-500",
    },
    {
      key: "handoffs",
      icon: Send,
      title: "Pending ADM hand-offs",
      count: kpis.admHandoffs,
      href: "/guidance/adm",
      hint: "Endorsed · with the coordinator",
      cta: "Open ADM cases",
      description: "ADM cases already endorsed and waiting on the coordinator.",
      accent: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  const preview = (referralsQueue ?? []).slice(0, PREVIEW_LIMIT);

  return (
    <TooltipProvider delayDuration={100}>
      <aside className="self-start lg:sticky lg:top-16" aria-label="Guidance KPI actions">
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
                    {a.key === "referred" && preview.length > 0 ? (
                      <ul className={styles.railCaseList}>
                        {preview.map((row) => (
                          <li key={row.id}>
                            <Link
                              href={`/guidance/referrals?highlight=${row.id}`}
                              className={styles.railCaseItem}
                              onClick={close}
                            >
                              <span className={styles.railCaseName} title={row.student}>
                                {row.student}
                              </span>
                              <span
                                className={`${styles.railCaseWait} ${
                                  STATUS_TONE[row.status] ??
                                  "text-muted-foreground"
                                }`}
                              >
                                {statusText(row.status)}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="flex-1 px-1 text-xs text-muted-foreground">
                        {a.key === "referred"
                          ? "All caught up — nothing waiting for review."
                          : a.hint}
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
