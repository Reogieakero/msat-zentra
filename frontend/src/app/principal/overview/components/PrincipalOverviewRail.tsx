"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Award,
  CalendarX,
  FileSignature,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTerm } from "@/lib/term/TermContext";
import { fetchOverview } from "@/services/principal/overview.service";
import type { OverviewData } from "@/services/principal/overview.types";
import styles from "./PrincipalOverviewRail.module.css";

// Flyout panel — same look as the teacher / registry icon rails: solid
// surface, shadow + ring, smooth open/close, anchored left of the rail icon.
const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

type RailKey = "risk" | "adm" | "attendance" | "honor";

interface RailItem {
  key: RailKey;
  icon: LucideIcon;
  /** Kanban board title + trigger label. */
  title: string;
  /** Tooltip subtitle — describes the queue (never a numeric value). */
  hint: string;
  href: string;
  cta: string;
  description: string;
  count: number;
  extra: { label: string; value: number }[];
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

function buildItems(data: OverviewData | undefined): RailItem[] {
  return [
    {
      key: "risk",
      icon: ShieldAlert,
      title: "At-risk students",
      hint: "Learners flagged this term",
      href: "/principal/risk/students",
      cta: "View at-risk students",
      description: "Learners carrying an attendance, academic, or behaviour flag.",
      count: data?.atRisk.students ?? 0,
      extra: [
        { label: "Attendance trigger", value: data?.atRisk.attendance ?? 0 },
        { label: "Academics trigger", value: data?.atRisk.grades ?? 0 },
        { label: "Behaviour trigger", value: data?.atRisk.behavior ?? 0 },
      ],
    },
    {
      key: "adm",
      icon: FileSignature,
      title: "ADM referrals",
      hint: "Referrals awaiting review",
      href: "/principal/adm/referrals/all",
      cta: "Review referrals",
      description: "Alternative Delivery Mode referrals waiting on a principal decision.",
      count: data?.admPending ?? 0,
      extra: [],
    },
    {
      key: "attendance",
      icon: CalendarX,
      title: "Attendance watch",
      hint: "Sections below the threshold",
      href: "/principal/risk/heatmaps/attendance",
      cta: "View attendance heatmap",
      description: "Sections sitting below the attendance threshold this term.",
      count: data?.attendanceWatch ?? 0,
      extra: [],
    },
    {
      key: "honor",
      icon: Award,
      title: "Honor roll",
      hint: "Qualifiers this term",
      href: "/principal/honor-roll",
      cta: "View honor roll",
      description: "Learners who qualify for the honor roll this term.",
      count: data?.honorRoll ?? 0,
      extra: [],
    },
  ];
}

/**
 * Icon-only right rail for the principal overview — one amber icon per
 * follow-up queue, same tooltip + flyout interaction as the registry desk
 * rail (OverviewKpiRail). Hover shows the queue *label* only; clicking opens
 * the queue as a kanban board with its CTA.
 */
export function PrincipalOverviewRail() {
  const { activeTerm } = useTerm();
  const [openKey, setOpenKey] = React.useState<RailKey | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ["overview", activeTerm?.termId ?? null],
    queryFn: fetchOverview,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      // Portaled tooltips live outside the rail — interacting with them must
      // not dismiss the open panel.
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

  const toggle = (key: RailKey) => setOpenKey((prev) => (prev === key ? null : key));
  const panel = (key: RailKey) =>
    `${MENU_PANEL} ${styles.menu} ${
      openKey === key ? styles.menuOpen : styles.menuClosed
    }`;

  const items = buildItems(data);

  return (
    <TooltipProvider delayDuration={100}>
      <aside className={styles.rail} aria-label="Follow-up queues">
        <div ref={railRef} className={styles.railInner}>
          {items.map((a) => {
            const Icon = a.icon;
            const opened = openKey === a.key;
            const showBadge = !isPending && !isError && a.count > 0;
            return (
              <div key={a.key} className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <GutterIconButton
                      label={a.title}
                      expanded={opened}
                      onToggle={() => toggle(a.key)}
                    >
                      <span className={styles.icon} aria-hidden>
                        <Icon size={16} />
                      </span>
                      {showBadge ? (
                        <span className={styles.badge} aria-hidden="true">
                          {a.count}
                        </span>
                      ) : null}
                    </GutterIconButton>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={10}>
                    <span className={styles.tipTitle}>{a.title}</span>
                    <span className={styles.tipHint}>{a.hint}</span>
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
                      <span className={styles.icon} aria-hidden>
                        <Icon size={14} />
                      </span>
                    }
                    count={
                      isPending ? (
                        <Skeleton className="h-4 w-6" />
                      ) : isError ? (
                        "—"
                      ) : (
                        a.count
                      )
                    }
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
                            onClick={() => setOpenKey(null)}
                          >
                            {a.cta}
                            <ArrowRight size={14} aria-hidden />
                          </Link>
                        </Button>
                      </div>
                    }
                  >
                    {a.extra.length > 0 ? (
                      <ul className={styles.extraList}>
                        {a.extra.map((row) => (
                          <li key={row.label} className={styles.extraRow}>
                            <span className={styles.extraLabel}>{row.label}</span>
                            <span className={styles.extraValue}>{row.value}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={styles.hintText}>{a.hint}</p>
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
