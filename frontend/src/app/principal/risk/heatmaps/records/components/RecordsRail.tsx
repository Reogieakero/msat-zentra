"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, ShieldAlert } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fetchRecords } from "@/services/principal/records.service";
import { RecordsBreakdownContent } from "./RecordsBreakdown";
import { RecordsAttentionContent } from "./RecordsAttention";
import styles from "./RecordsRail.module.css";

// Flyout panel — same look as the principal overview rail: solid surface,
// shadow + ring, smooth open/close, anchored left of the rail icon.
const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

type RailTone = "amber" | "red";

/** Two follow-up queues, each with its own icon and kanban flyout. */
const RAIL_ITEMS = [
  {
    key: "breakdown",
    icon: FileText,
    title: "Anecdotal record breakdown",
    hint: "Categories, severity and record load",
    description:
      "Records grouped by anecdotal category and severity for the active term.",
    tone: "amber" as RailTone,
  },
  {
    key: "attention",
    icon: ShieldAlert,
    title: "Needs attention",
    hint: "Heaviest record load this term",
    description:
      "The three learners carrying the most anecdotal records this term.",
    tone: "red" as RailTone,
  },
];

/**
 * Icon-only rail for the records desk — one icon per breakdown queue, same
 * hover-label + kanban flyout interaction as the principal overview rail.
 */
export function RecordsRail() {
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);

  // Same key as the boards — TanStack dedupes the fetch.
  const { data } = useQuery({
    queryKey: ["records-heatmap"],
    queryFn: fetchRecords,
  });

  const counts = React.useMemo(() => {
    const students = (data?.sections ?? []).flatMap((s) => s.students);
    return {
      breakdown: students.reduce((a, s) => a + s.behavioral.length, 0),
      attention: students.filter((s) => s.behavioral.length > 0).length,
    } as Record<string, number>;
  }, [data]);

  React.useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      // Portaled tooltips live outside the rail — interacting with them must
      // not dismiss the open panel.
      if (
        target?.closest?.(
          '[data-slot="popover-content"], [data-slot="tooltip-content"]'
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

  const toggle = (key: string) =>
    setOpenKey((prev) => (prev === key ? null : key));

  return (
    <TooltipProvider delayDuration={100}>
      <aside className={styles.rail} aria-label="Records follow-up queues">
        <div ref={railRef} className={styles.railInner}>
          {RAIL_ITEMS.map((item) => {
            const Icon = item.icon;
            const opened = openKey === item.key;
            const count = counts[item.key] ?? 0;
            const isRed = item.tone === "red";
            return (
              <div key={item.key} className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => toggle(item.key)}
                      aria-expanded={opened}
                      aria-haspopup="dialog"
                      aria-label={
                        opened ? `Close ${item.title}` : `Open ${item.title}`
                      }
                      className={`relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition-colors ${
                        opened
                          ? isRed
                            ? "border-red-500/60 bg-red-500/10"
                            : "border-amber-500/60 bg-amber-500/10"
                          : isRed
                            ? "border-border bg-card hover:border-red-500/60 hover:bg-red-500/10"
                            : "border-border bg-card hover:border-amber-500/60 hover:bg-amber-500/10"
                      }`}
                    >
                      <span
                        className={isRed ? styles.iconRed : styles.iconAmber}
                        aria-hidden
                      >
                        <Icon size={16} />
                      </span>
                      {count > 0 ? (
                        <span
                          className={isRed ? styles.badgeRed : styles.badge}
                          aria-hidden="true"
                        >
                          {count}
                        </span>
                      ) : null}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={10}>
                    <span className={styles.tipTitle}>{item.title}</span>
                    <span className={styles.tipHint}>{item.hint}</span>
                  </TooltipContent>
                </Tooltip>
                <div
                  role="dialog"
                  aria-label={item.title}
                  aria-hidden={opened ? undefined : true}
                  className={`${MENU_PANEL} ${styles.menu} ${
                    opened ? styles.menuOpen : styles.menuClosed
                  }`}
                >
                  <KanbanBoard
                    title={item.title}
                    icon={
                      <span
                        className={isRed ? styles.iconRed : styles.iconAmber}
                        aria-hidden
                      >
                        <Icon size={14} />
                      </span>
                    }
                    count={count}
                    description={item.description}
                    className={`border-0 ${
                      isRed ? styles.boardRed : styles.boardAmber
                    }`}
                  >
                    {item.key === "breakdown" ? (
                      <RecordsBreakdownContent />
                    ) : (
                      <RecordsAttentionContent />
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
