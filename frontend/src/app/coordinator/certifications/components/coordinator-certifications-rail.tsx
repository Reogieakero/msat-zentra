"use client";

import * as React from "react";
import { BarChart3, PieChart, type LucideIcon } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CertSummary } from "@/services/coordinator/certifications.types";
import { CoordinatorCertificationsCharts } from "./coordinator-certifications-charts";
import { CoordinatorCertificationsGradeChart } from "./coordinator-certifications-grade";
import styles from "./coordinator-certifications.module.css";

// Flyout panel — same shell as the coordinator overview rail: solid surface,
// shadow + ring, smooth open/close anchored left of the rail icon.
const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

type RailKey = "status" | "grade";

interface RailItem {
  key: RailKey;
  icon: LucideIcon;
  title: string;
  description: string;
  count: number;
}

function GutterIconButton({
  label,
  expanded,
  onToggle,
  children,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
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
 * Icon-only right rail for /coordinator/certifications — one icon per insight
 * board (status donut, grade bars). Clicking an icon opens a kanban board
 * flyout with the amber chart, matching the coordinator overview rail.
 */
export function CoordinatorCertificationsRail({
  summary,
}: {
  summary: CertSummary;
}) {
  const [openKey, setOpenKey] = React.useState<RailKey | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);
  const gradeCount = (summary.byGrade ?? []).filter((r) => r.count > 0).length;

  React.useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
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

  const toggle = (key: RailKey) =>
    setOpenKey((prev) => (prev === key ? null : key));
  const panel = (key: RailKey) =>
    `${MENU_PANEL} ${styles.railMenu} ${
      openKey === key ? styles.railMenuOpen : styles.railMenuClosed
    }`;

  const items: RailItem[] = [
    {
      key: "status",
      icon: PieChart,
      title: "Certifications by status",
      description: "Every certification you issued — live counts by status.",
      count: summary.total,
    },
    {
      key: "grade",
      icon: BarChart3,
      title: "Certifications by grade level",
      description: "Live counts across every certification you issued.",
      count: gradeCount,
    },
  ];

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className="self-start lg:sticky lg:top-16"
        aria-label="Certification insights"
      >
        <div
          ref={railRef}
          className="flex flex-row justify-end gap-2 lg:flex-col lg:items-end"
        >
          {items.map((item) => {
            const Icon = item.icon;
            const opened = openKey === item.key;
            const showBadge = item.count > 0;
            return (
              <div key={item.key} className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <GutterIconButton
                      label={item.title}
                      expanded={opened}
                      onToggle={() => toggle(item.key)}
                    >
                      <span className="text-amber-500" aria-hidden>
                        <Icon size={16} />
                      </span>
                      {showBadge ? (
                        <span
                          className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black"
                          aria-hidden="true"
                        >
                          {item.count}
                        </span>
                      ) : null}
                    </GutterIconButton>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={10}>
                    <GutterTip
                      title={item.title}
                      hint={item.count > 0 ? `${item.count} total` : "Nothing yet"}
                    />
                  </TooltipContent>
                </Tooltip>

                <div
                  role="dialog"
                  aria-label={item.title}
                  aria-hidden={opened ? undefined : true}
                  className={panel(item.key)}
                >
                  <KanbanBoard
                    title={item.title}
                    icon={
                      <span className="text-amber-500" aria-hidden>
                        <Icon size={14} />
                      </span>
                    }
                    count={item.count}
                    description={item.description}
                    className="border-0 pt-4"
                  >
                    {item.key === "status" ? (
                      <CoordinatorCertificationsCharts summary={summary} bare />
                    ) : (
                      <CoordinatorCertificationsGradeChart summary={summary} bare />
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
