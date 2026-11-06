"use client";

import * as React from "react";
import { Workflow } from "lucide-react";
import {
  GradePipeline,
  type GradePipelineCounts,
} from "./GradePipeline";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RegistryDesk } from "@/services/registry/overview.service";
import menuStyles from "./PipelineRail.module.css";

const PIPELINE_LABEL = "Final Grade Approval Pipeline";

// Flyout panel — same look + motion as the overview KPI rail: solid
// surface, shadow + ring, opens left of the rail icon.
const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

/**
 * Icon-only right rail for the registry final-grades desks (record keeper /
 * registrar) — the approval pipeline as a single gutter icon (same tooltip +
 * flyout interaction as the overview KPI rail). Clicking the icon drops down
 * a kanban board with the stages stacked vertically; the card chrome lives on
 * the flyout, not on a glow card in the page body.
 */
export function PipelineRail({
  desk,
  counts,
  isLoading,
  isError,
}: {
  desk: RegistryDesk;
  counts: GradePipelineCounts;
  isLoading?: boolean;
  isError?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const railRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
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
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const ready = counts.complete ?? 0;
  const tip = isError
    ? "Could not load"
    : isLoading
      ? "Loading…"
      : ready > 0
        ? `${ready} complete set${ready === 1 ? "" : "s"}`
        : "No complete sets yet";

  return (
    <TooltipProvider delayDuration={100}>
      <aside className="self-start lg:sticky lg:top-16" aria-label="Final grade pipeline">
        <div ref={railRef} className="flex flex-row justify-end lg:flex-col lg:items-end">
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setOpen((prev) => !prev)}
                  aria-expanded={open}
                  aria-haspopup="dialog"
                  aria-label={open ? `Close ${PIPELINE_LABEL}` : `Open ${PIPELINE_LABEL}`}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                    open
                      ? "cursor-pointer border-amber-500/60 bg-amber-500/10"
                      : "cursor-pointer border-border bg-card hover:border-amber-500/60 hover:bg-amber-500/10"
                  }`}
                >
                  <span className="text-amber-500" aria-hidden>
                    <Workflow size={16} />
                  </span>
                  {!isLoading && !isError && ready > 0 ? (
                    <span
                      className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black"
                      aria-hidden="true"
                    >
                      {ready}
                    </span>
                  ) : null}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <span className="font-medium">{PIPELINE_LABEL}</span>
                <span className="opacity-60">{tip}</span>
              </TooltipContent>
            </Tooltip>
            <div
              role="dialog"
              aria-label={PIPELINE_LABEL}
              aria-hidden={open ? undefined : true}
              className={`${MENU_PANEL} ${menuStyles.menu} ${
                open ? menuStyles.menuOpen : menuStyles.menuClosed
              }`}
            >
              <KanbanBoard
                title={PIPELINE_LABEL}
                icon={
                  <span className="text-amber-500" aria-hidden>
                    <Workflow size={14} />
                  </span>
                }
                description={`Grades lock at the subject teacher — the ${
                  desk === "registrar" ? "registrar" : "record keeper"
                } is view-only once a student's full term is complete.`}
                className="border-0"
              >
                <GradePipeline
                  desk={desk}
                  counts={counts}
                  isLoading={isLoading}
                  orientation="vertical"
                  embedded
                />
              </KanbanBoard>
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
