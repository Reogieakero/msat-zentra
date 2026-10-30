"use client";

import * as React from "react";
import { BookOpenText, Clock3, Hourglass, Users } from "lucide-react";
import { WEEK_LABELS_FULL } from "@/services/teacher/schedule";
import {
  buildTimetable,
  formatRange,
  type DayConfig,
} from "@/app/teacher/schedule/components/schedule-time";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import kanban from "@/app/teacher/overview/components/advisory-schedule-kanban.module.css";

const DAYS = [1, 2, 3, 4, 5];

export interface MyWeekSlot {
  day: number;
  period: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  subject: { id: string; name: string; code: string };
  section: { id: string; name: string; gradeLevel: string };
}

export function MyWeekGrid({
  slots,
  config,
  nowKey = null,
}: {
  slots: MyWeekSlot[];
  config: DayConfig;
  nowKey?: string | null;
}) {
  const timetable = React.useMemo(() => buildTimetable(config), [config]);
  const timeByPeriod = React.useMemo(() => {
    const map = new Map<number, { startMin: number; endMin: number }>();
    for (const row of timetable) {
      if (row.kind === "period")
        map.set(row.periodIndex, { startMin: row.startMin, endMin: row.endMin });
    }
    return map;
  }, [timetable]);

  return (
    <div
      className={`grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 ${kanban.view}`}
      aria-label="Weekly schedule by day"
    >
      {DAYS.map((day, colIndex) => {
        const daySlots = slots
          .filter((s) => s.day === day)
          .slice()
          .sort((a, b) => a.period - b.period || a.section.id.localeCompare(b.section.id));

        return (
          <KanbanBoard
            key={day}
            className={kanban.column}
            style={{ "--col-index": colIndex } as React.CSSProperties}
            title={WEEK_LABELS_FULL[day - 1]}
            count={daySlots.length}
            ariaLabel={`${WEEK_LABELS_FULL[day - 1]} schedule, ${daySlots.length} classes`}
          >
            <div className="flex flex-col gap-2">
              {daySlots.length === 0 ? (
                <div
                  aria-label={`${WEEK_LABELS_FULL[day - 1]}, no classes`}
                  className="flex min-h-[6rem] items-center justify-center rounded-lg border border-dashed border-input px-2 py-6 text-center text-xs text-muted-foreground"
                >
                  No classes
                </div>
              ) : (
                daySlots.map((entry, cardIndex) => {
                  const t = timeByPeriod.get(entry.period);
                  const range = t
                    ? formatRange(t.startMin, t.endMin)
                    : `Period ${entry.period + 1}`;
                  const mins = t ? t.endMin - t.startMin : 0;
                  const isNow = nowKey === `${entry.day}:${entry.period}`;
                  const sectionLabel = entry.section.name;
                  const label = `${WEEK_LABELS_FULL[day - 1]} ${range}, ${entry.subject.name} (${entry.subject.code}) with ${sectionLabel}, ${mins} minutes${isNow ? ", current class" : ""}`;
                  return (
                    <article
                      key={`${entry.day}:${entry.period}:${entry.section.id}:${entry.subject.id}:${cardIndex}`}
                      aria-label={label}
                      title={`${entry.subject.name} — ${sectionLabel} — ${range}`}
                      style={
                        {
                          "--col-index": colIndex,
                          "--card-index": cardIndex,
                        } as React.CSSProperties
                      }
                      className={`relative flex flex-col gap-1.5 rounded-lg border p-2.5 text-left ${kanban.card} ${
                        isNow
                          ? `border-green-500 bg-green-500/10 ring-2 ring-green-500 ${kanban.cardNow}`
                          : "border-input bg-card hover:border-amber-500/60"
                      }`}
                    >
                      {isNow ? (
                        <Pill tone="green" label="Happening now">
                          <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                          </span>
                          Now
                        </Pill>
                      ) : null}
                      <span className="flex items-start gap-1.5">
                        <BookOpenText
                          size={14}
                          className="mt-0.5 shrink-0 text-amber-500"
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] leading-tight font-semibold">
                            {entry.subject.name}
                          </span>
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock3 size={12} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">{range}</span>
                      </span>
                      <span className="flex flex-col gap-1.5">
                        <Pill tone="amber" label="Class duration" className="w-fit">
                          <Hourglass size={11} aria-hidden="true" />
                          {mins > 0 ? `${mins} min` : "—"}
                        </Pill>
                        <span className="flex justify-end">
                          <Pill
                            tone="neutral"
                            label="Section"
                            title={sectionLabel}
                            className="min-w-0 max-w-full"
                          >
                            <Users
                              size={11}
                              className="shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <span className="truncate">{sectionLabel}</span>
                          </Pill>
                        </span>
                      </span>
                    </article>
                  );
                })
              )}
            </div>
          </KanbanBoard>
        );
      })}
    </div>
  );
}
