"use client";

import { Pill } from "@/components/ui/pill";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { CalendarClock, Clock } from "lucide-react";
import {
  formatCountdown,
  formatDate,
  formatTime,
  isSessionStarted,
  toDateInputValue,
} from "@/lib/labels/datetime";
import { sessionTypeLabel } from "@/lib/labels/sessions";
import type {
  NurseQueueRow,
  NurseSessionItem,
} from "@/services/nurse/nurse.types";
import { useNowMs } from "./use-now-ms";

/**
 * Booked-session schedule board — shows the booking beside the queue row's
 * kebab ("Session schedule…"): rendered as dropdown sub-content anchored at
 * the menu item, so it flies out next to the icon instead of covering the
 * screen. Read-only: date, time, venue, type, and a live countdown.
 */
export function NurseSessionScheduleBoard({
  row,
  session,
}: {
  row: NurseQueueRow;
  session: NurseSessionItem;
}) {
  // Ticks every second so the countdown stays honest while the board is open.
  const nowMs = useNowMs(1000);
  const startsAt = new Date(session.scheduledAt).getTime();
  const started = isSessionStarted(session.scheduledAt, nowMs);
  const dateKey = session.date || toDateInputValue(session.scheduledAt);

  return (
    <div className="w-[22rem]">
      <KanbanBoard
        className="bg-card shadow-2xl"
        title="Session schedule"
        icon={
          <span className="text-primary" aria-hidden>
            <CalendarClock size={14} />
          </span>
        }
        description={`${row.student}'s booked clinic session.`}
      >
        <div className="flex items-center gap-2 px-1">
          <StudentMascot
            name={row.student}
            seed={row.lrn}
            character={row.mascot ?? undefined}
            size={32}
          />
          <span className="min-w-0 truncate text-sm font-semibold text-primary">
            {row.student}
          </span>
          <Pill label="LRN" className="tabular-nums">
            {row.lrn}
          </Pill>
          {row.section && row.section !== "—" && (
            <Pill label="Section">{row.section}</Pill>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 px-1">
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Date</dt>
            <dd className="text-[13px] font-medium">
              {formatDate(dateKey) || "—"}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Time</dt>
            <dd className="text-[13px] font-medium tabular-nums">
              {formatTime(session.scheduledAt)}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Venue</dt>
            <dd className="text-[13px] font-medium">{session.venue || "—"}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Session type</dt>
            <dd className="text-[13px] font-medium">
              {sessionTypeLabel(session.sessionType)}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <Pill tone="blue" label="Session status">
            Scheduled
          </Pill>
          {Number.isFinite(startsAt) && startsAt > 0 ? (
            <Pill
              label={`Starts ${formatDate(dateKey)} ${formatTime(session.scheduledAt)}`}
              className="gap-1 tabular-nums"
            >
              <Clock size={11} aria-hidden />
              {started
                ? "Due now"
                : `starts in ${formatCountdown(startsAt, nowMs)}`}
            </Pill>
          ) : null}
        </div>
      </KanbanBoard>
    </div>
  );
}
