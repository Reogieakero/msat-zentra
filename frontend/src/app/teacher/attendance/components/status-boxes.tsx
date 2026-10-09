"use client";
import * as React from "react";
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
}: {
  value: SheetStatus;
  onPick: (s: SheetStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {STATUS_BOXES.map((b) => {
        const isActive = b.value === value;
        return (
          <button
            key={b.value}
            type="button"
            onClick={() => onPick(b.value)}
            disabled={disabled}
            aria-pressed={isActive}
            aria-label={`Mark ${b.label}`}
            title={disabled ? `${b.label} — locked` : b.label}
            className={`flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              isActive
                ? b.activeClass
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
export const BLOCK_DOT: Record<SheetStatus, string> = {
  present: "bg-green-500",
  late: "bg-amber-500",
  absent: "bg-red-500",
  excused: "bg-gray-400",
};
export const BLOCK_LABEL: Record<SheetStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};
const MAX_VISIBLE_DOTS = 30;
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
  const hiddenCount = dates.length > MAX_VISIBLE_DOTS ? dates.length - MAX_VISIBLE_DOTS : 0;
  const visible = hiddenCount > 0 ? dates.slice(dates.length - MAX_VISIBLE_DOTS) : dates;
  return (
    <div
      className="flex items-center gap-[3px] overflow-x-auto py-0.5"
      style={{ scrollbarWidth: "none" }}
      role="img"
      aria-label={`${dates.length} meetup days`}
    >
      {hiddenCount > 0 ? (
        <span
          title={`${hiddenCount} earlier meetup${hiddenCount === 1 ? "" : "s"}`}
          className="flex h-[17px] shrink-0 items-center rounded-[4px] border border-border/60 bg-muted px-1 text-[10px] font-semibold text-muted-foreground"
        >
          +{hiddenCount}
        </span>
      ) : null}
      {visible.map((d) => {
        const s = statusOf(studentId, d);
        const autoAbsent = !s && pastDue(d);
        return (
          <span
            key={d}
            title={
              s
                ? `${d} — ${BLOCK_LABEL[s]}`
                : autoAbsent
                  ? `${d} — absent (not logged)`
                  : `${d} — no record`
            }
            className={`h-[17px] w-[17px] shrink-0 rounded-[4px] border border-border/60 ${
              s ? BLOCK_DOT[s] : autoAbsent ? "bg-red-500" : "bg-muted"
            }`}
          />
        );
      })}
    </div>
  );
});
export function rateClass(rate: number): string {
  if (rate >= 0.9) return "text-green-600 dark:text-green-500";
  if (rate >= 0.75) return "text-amber-600 dark:text-amber-500";
  return "text-red-600 dark:text-red-500";
}
