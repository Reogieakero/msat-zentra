"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import menuStyles from "./Sf10UploadRail.module.css";

const UPLOAD_LABEL = "Upload SF10";

// Flyout panel — same look + motion as the overview KPI rail: solid
// surface, shadow + ring, opens left of the rail icon.
const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

/**
 * Icon-only right rail for /record-keeper/sf10 — a single upload gutter
 * icon (same tooltip + flyout interaction as the overview KPI rail).
 * Clicking the icon drops down a kanban board with the compact 24px
 * upload action; the record-keeper page header was dropped so the rail
 * owns the desk's upload entry point.
 */
export function Sf10UploadRail({
  desk,
}: {
  desk: "registrar" | "record-keeper";
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

  return (
    <TooltipProvider delayDuration={100}>
      <aside className="self-start lg:sticky lg:top-16" aria-label={UPLOAD_LABEL}>
        <div
          ref={railRef}
          className="flex flex-row justify-end gap-2 lg:flex-col lg:items-end"
        >
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setOpen((prev) => !prev)}
                  aria-expanded={open}
                  aria-haspopup="dialog"
                  aria-label={open ? `Close ${UPLOAD_LABEL}` : `Open ${UPLOAD_LABEL}`}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                    open
                      ? "cursor-pointer border-amber-500/60 bg-amber-500/10"
                      : "cursor-pointer border-border bg-card hover:border-amber-500/60 hover:bg-amber-500/10"
                  }`}
                >
                  <span className="text-amber-500" aria-hidden>
                    <Upload size={16} />
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <span className="font-medium">{UPLOAD_LABEL}</span>
                <span className="opacity-60">Attach a new record</span>
              </TooltipContent>
            </Tooltip>
            <div
              role="dialog"
              aria-label={UPLOAD_LABEL}
              aria-hidden={open ? undefined : true}
              className={`${MENU_PANEL} ${menuStyles.menu} ${
                open ? menuStyles.menuOpen : menuStyles.menuClosed
              }`}
            >
              <KanbanBoard
                title={UPLOAD_LABEL}
                icon={
                  <span className="text-amber-500" aria-hidden>
                    <Upload size={14} />
                  </span>
                }
                description="Attach a learner's SF10 file — filed as-is, then validated and released from the desk."
                className="border-0"
                footer={
                  <div className="flex justify-end gap-1.5 px-1 pb-1">
                    <Button asChild size="sm" className="h-6 px-2 text-xs">
                      <Link
                        href={`/${desk}/sf10/upload`}
                        aria-label={`${UPLOAD_LABEL} — open the upload form`}
                        onClick={() => setOpen(false)}
                      >
                        {UPLOAD_LABEL}
                        <ArrowRight size={14} aria-hidden />
                      </Link>
                    </Button>
                  </div>
                }
              >
                <p className="flex-1 px-1 text-xs text-muted-foreground">
                  One SF10 file per learner record.
                </p>
              </KanbanBoard>
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
