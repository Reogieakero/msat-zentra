"use client";

import * as React from "react";
import { ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BreakdownReadout, type AccountBreakdown } from "./AccountsBreakdown";
import menuStyles from "./accounts-breakdown-rail.module.css";

// Flyout panel — same look as the overview KPI rail / teacher icon rails:
// solid surface, shadow + ring, smooth open/close. Anchored left of the icon.
const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

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

// Kanban chip — rectangle pill matching the app's meta pills (amber tone,
// same framing as the final-grades lead pills).
const PILL =
  "inline-flex max-w-full items-center rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-400";

/** "Grade 11 · Mendel" → separate grade / section parts (no dot separator). */
function labelParts(label: string): { grade: string; section: string } {
  const [grade = label, section = ""] = label.split("·").map((p) => p.trim());
  return { grade, section };
}

/** Section search term from a "Grade 11 · Mendel" breakdown label. */
function sectionOf(label: string): string {
  const { section } = labelParts(label);
  return section && section.toLowerCase() !== "unsectioned" ? section : "";
}

/**
 * Icon-only right rail for /registrar/accounts — one icon per Accounts
 * Breakdown section column (not the overview action queues). Each icon
 * carries the section's pending count and opens a kanban flyout with the
 * section's donut/legend readout plus a "Review accounts" action that
 * filters the pending queue to that section.
 */
export function AccountsBreakdownRail({
  data,
  loading = false,
  onReview,
}: {
  data: AccountBreakdown[];
  loading?: boolean;
  /**
   * Called with the section search term when "Review accounts" is clicked —
   * the page applies it to the pending queue search.
   */
  onReview?: (section: string) => void;
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!openId) return;
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
        setOpenId(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openId]);

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));
  const panel = (id: string) =>
    `${MENU_PANEL} ${menuStyles.menu} ${
      openId === id ? menuStyles.menuOpen : menuStyles.menuClosed
    }`;

  if (loading) {
    return (
      <aside className="self-start lg:sticky lg:top-16" aria-label="Accounts breakdown by section">
        <div
          className="flex flex-row justify-end gap-2 lg:flex-col lg:items-end"
          aria-hidden="true"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-9 rounded-xl" />
          ))}
        </div>
      </aside>
    );
  }

  if (data.length === 0) return null;

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className="self-start lg:sticky lg:top-16"
        aria-label="Accounts breakdown by section"
      >
        <div
          ref={railRef}
          className="flex flex-row justify-end gap-2 lg:flex-col lg:items-end"
        >
          {data.map((item) => {
            const noAccount = item.noAccount ?? 0;
            const total = item.total ?? item.withAccount + item.pending + noAccount;
            const term = sectionOf(item.label);
            const parts = labelParts(item.label);
            const opened = openId === item.id;
            const hint =
              item.pending > 0
                ? `${item.pending} pending · ${total} learners`
                : `${total} learners — all caught up`;
            return (
              <div key={item.id} className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <GutterIconButton
                      label={`${item.label} breakdown`}
                      expanded={opened}
                      onToggle={() => toggle(item.id)}
                    >
                      <span className="text-primary" aria-hidden>
                        <Users size={16} />
                      </span>
                      {item.pending > 0 ? (
                        <span
                          className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black"
                          aria-hidden="true"
                        >
                          {item.pending}
                        </span>
                      ) : null}
                    </GutterIconButton>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={10}>
                    <span className="font-medium">{item.label}</span>
                    <span className="opacity-60">{hint}</span>
                  </TooltipContent>
                </Tooltip>
                <div
                  role="dialog"
                  aria-label={item.label}
                  aria-hidden={opened ? undefined : true}
                  className={panel(item.id)}
                >
                  <KanbanBoard
                    title={
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className={`${PILL} min-w-0`}>
                          <span className="min-w-0 truncate">{parts.grade}</span>
                        </span>
                        {parts.section ? (
                          <span className={`${PILL} min-w-0`}>
                            <span className="min-w-0 truncate">{parts.section}</span>
                          </span>
                        ) : null}
                      </span>
                    }
                    icon={
                      <span className="text-primary" aria-hidden>
                        <Users size={14} />
                      </span>
                    }
                    count={total}
                    description={`${total} learners in this section roster.`}
                    className="border-0"
                    footer={
                      term && onReview ? (
                        <div className="flex justify-end gap-1.5 px-1 pb-1">
                          <Button
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              setOpenId(null);
                              onReview(term);
                            }}
                          >
                            Review accounts
                            <ArrowRight size={14} aria-hidden />
                          </Button>
                        </div>
                      ) : undefined
                    }
                  >
                    <div className="px-1 pb-1">
                      <BreakdownReadout
                        withAccount={item.withAccount}
                        pending={item.pending}
                        noAccount={noAccount}
                        tone="amber"
                      />
                    </div>
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
