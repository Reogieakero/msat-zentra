"use client";
import { Coffee, Utensils } from "lucide-react";
import { WEEK_LABELS_SHORT } from "@/services/teacher/schedule";
import {
  formatRange,
  type DayConfig,
} from "@/app/teacher/schedule/components/schedule-time";
import emptyStyles from "@/app/teacher/schedule/schedule-empty.module.css";
import type { SubmissionEntry } from "./use-principal-schedule-section";
const DAYS = [1, 2, 3, 4, 5];
export function ScheduleReadonlyGrid({
  config,
  rows,
  entryByKey,
}: {
  config: DayConfig | null;
  rows: ReturnType<typeof import("@/app/teacher/schedule/components/schedule-time").buildTimetable>;
  entryByKey: Map<string, SubmissionEntry>;
}) {
  if (!config) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load timetable times — approve by slot count instead, or try again later.
      </p>
    );
  }
  return (
    <div className={`overflow-x-auto rounded-lg border ${emptyStyles.noScrollbar}`}>
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className="w-28 p-2 text-left">
              <span className="sr-only">Time</span>
            </th>
            {DAYS.map((day) => (
              <th key={day} scope="col" className="p-2 text-center text-xs font-semibold">
                {WEEK_LABELS_SHORT[day - 1]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            if (row.kind !== "period") {
              const isLunch = row.kind === "lunch";
              return (
                <tr key={`break-${ri}`}>
                  <td
                    colSpan={DAYS.length + 1}
                    className="border-t bg-muted/40 px-2 py-1 text-center text-xs text-muted-foreground"
                  >
                    {isLunch ? (
                      <>
                        <Utensils size={12} className="mr-1 inline" aria-hidden />
                        Lunch Break · {formatRange(row.startMin, row.endMin)}
                      </>
                    ) : (
                      <>
                        <Coffee size={12} className="mr-1 inline" aria-hidden /> {row.label} ·{" "}
                        {formatRange(row.startMin, row.endMin)}
                      </>
                    )}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={`period-${row.periodIndex}`}>
                <th
                  scope="row"
                  className="border-t p-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground"
                >
                  {formatRange(row.startMin, row.endMin)}
                </th>
                {DAYS.map((day) => {
                  const entry = entryByKey.get(`${day}:${row.periodIndex}`) ?? null;
                  const timeLabel = `${WEEK_LABELS_SHORT[day - 1]} ${formatRange(row.startMin, row.endMin)}`;
                  if (!entry) {
                    return (
                      <td key={day} className="border-t p-1">
                        <div
                          aria-label={`${timeLabel}, empty`}
                          title="Empty slot"
                          className="flex min-h-14 w-full items-center justify-center rounded-md border border-dashed border-input px-1 text-center text-xs text-muted-foreground"
                        >
                          <span aria-hidden="true">—</span>
                        </div>
                      </td>
                    );
                  }
                  const statusName =
                    entry.status === "APPROVED"
                      ? "approved"
                      : entry.status === "SUBMITTED"
                        ? "submitted"
                        : "draft";
                  const dotClass =
                    entry.status === "APPROVED"
                      ? "bg-green-500"
                      : entry.status === "SUBMITTED"
                        ? "bg-blue-500"
                        : "bg-red-500";
                  const label = `${timeLabel}, ${entry.subject.name}${entry.teacherName ? ` with ${entry.teacherName.name}` : ""} (${statusName})`;
                  return (
                    <td key={day} className="border-t p-1">
                      <div className="relative">
                        <div
                          aria-label={label}
                          title={`${entry.subject.name}${entry.teacherName ? ` — ${entry.teacherName.name}` : ""} (${statusName})`}
                          className="flex min-h-14 w-full items-center justify-center rounded-md border border-solid bg-primary/5 px-1 py-1 text-center text-xs transition-colors"
                        >
                          <span className="flex min-w-0 max-w-full flex-col items-center leading-tight">
                            <span className="w-full truncate font-medium">
                              {entry.subject.name}
                            </span>
                            {entry.teacherName ? (
                              <span className="w-full truncate text-[11px] font-normal text-muted-foreground">
                                {entry.teacherName.name}
                              </span>
                            ) : null}
                          </span>
                        </div>
                        <span
                          aria-hidden="true"
                          title={statusName}
                          className={`absolute bottom-1.5 left-1.5 h-1.5 w-1.5 rounded-full ${dotClass}`}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
