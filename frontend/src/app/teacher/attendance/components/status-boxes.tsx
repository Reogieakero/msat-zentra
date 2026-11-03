"use client";
import * as React from "react";
import "@/components/ui/scroll-list.css";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SheetStatus } from "@/services/teacher/attendance.types";
export const STATUS_BOXES: { value: SheetStatus; letter: string; activeClass: string; label: string }[] = [
  { value: "present", letter: "P", activeClass: "bg-green-500/70 border-green-500/70 text-white", label: "Present" },
  { value: "absent", letter: "A", activeClass: "bg-red-500/70 border-red-500/70 text-white", label: "Absent" },
  { value: "late", letter: "L", activeClass: "bg-amber-500/70 border-amber-500/70 text-white", label: "Late" },
  { value: "excused", letter: "E", activeClass: "bg-blue-500/70 border-blue-500/70 text-white", label: "Excused" },
];
export const StatusBoxes = React.memo(function StatusBoxes({
  value,
  onPick,
  disabled,
  impliedAbsent,
}: {
  value: SheetStatus | null;
  onPick: (s: SheetStatus) => void;
  disabled?: boolean;
  impliedAbsent?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {STATUS_BOXES.map((b) => {
        const isActive = b.value === value;
        const isImplied = isActive && impliedAbsent && b.value === "absent";
        return (
          <button
            key={b.value}
            type="button"
            onClick={() => onPick(b.value)}
            disabled={disabled}
            aria-pressed={isActive}
            aria-label={isImplied ? "Absent (not logged) — tap to confirm" : `Mark ${b.label}`}
            title={disabled ? `${b.label} — locked` : isImplied ? "Absent — not logged (tap A to confirm)" : b.label}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              isActive
                ? isImplied
                  ? `${b.activeClass} border-dashed opacity-70`
                  : b.activeClass
                : "border-input bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            }`}
          >
            {b.letter}
          </button>
        );
      })}
    </div>
  );
});
/* Meetup block tones mirror the shared pill / StatusBoxes palette so the
   blocks, row pills and status buttons read as one design language. */
export const BLOCK_DOT: Record<SheetStatus, string> = {
  present: "border-green-500/70 bg-green-500/70",
  late: "border-amber-500/70 bg-amber-500/70",
  absent: "border-red-500/70 bg-red-500/70",
  excused: "border-blue-500/70 bg-blue-500/70",
};
export const BLOCK_LABEL: Record<SheetStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};
export const MeetupBlocksCell = React.memo(function MeetupBlocksCell({
  dates,
  statusOf,
  pastDue,
  loading,
  hasTerm,
  studentId,
}: {
  dates: string[];
  statusOf: (id: string, date: string) => SheetStatus | null;
  pastDue: (date: string) => boolean;
  loading: boolean;
  hasTerm: boolean;
  studentId: string;
}) {
  if (loading) {
    return <span className="text-xs text-muted-foreground">Loading meetups…</span>;
  }
  if (!hasTerm || dates.length === 0) {
    return <span className="text-xs text-muted-foreground">No meetup dates.</span>;
  }
  // All meetup dots from term start to the latest meetup are displayed —
  // no "+N" collapsing. The row scrolls horizontally when there are many.
  return (
    <TooltipProvider delayDuration={120}>
      <div
        className="zentra-scroll flex items-center gap-[3px] overflow-x-auto py-0.5"
        role="img"
        aria-label={`${dates.length} meetup days`}
      >
        {dates.map((d) => {
          const s = statusOf(studentId, d);
          const autoAbsent = !s && pastDue(d);
          const label = s
            ? BLOCK_LABEL[s]
            : autoAbsent
              ? "Absent (not logged)"
              : "No record";
          return (
            <Tooltip key={d}>
              <TooltipTrigger asChild>
                <span
                  aria-label={`${d} — ${label}`}
                  className={cn(
                    "h-[17px] w-[17px] shrink-0 rounded-md border transition-colors",
                    s
                      ? BLOCK_DOT[s]
                      : autoAbsent
                        ? "border-red-500/70 border-dashed bg-red-500/70"
                        : "border-border/60 bg-muted",
                  )}
                />
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                <span className="font-medium tabular-nums">{d}</span>
                <span className="opacity-50">—</span>
                <span className="font-semibold">{label}</span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
});
export function rateClass(rate: number): string {
  if (rate >= 0.9) return "text-green-600 dark:text-green-500";
  if (rate >= 0.75) return "text-amber-600 dark:text-amber-500";
  return "text-red-600 dark:text-red-500";
}
