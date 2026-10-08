"use client";

import { Coffee, Utensils } from "lucide-react";
import { WEEK_LABELS_SHORT } from "@/services/teacher/schedule";
import { buildTimetable, formatRange, type DayConfig } from "@/app/teacher/schedule/components/schedule-time";
import emptyStyles from "@/app/teacher/schedule/schedule-empty.module.css";

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
  const rows = buildTimetable(config);
  const entryByKey = new Map(slots.map((s) => [`${s.day}:${s.period}`, s]));
  const nowPeriod = nowKey?.split(":")[1] ?? null;

  return (
    <div className={`overflow-x-auto rounded-lg border ${emptyStyles.noScrollbar}`}>
        <table className="w-full min-w-[40rem] table-fixed border-collapse text-sm">
          <thead>
              <tr>
                <th scope="col" className="w-36 p-2 text-left">
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
                    <span className="inline-flex items-center gap-1.5">
                      {nowPeriod !== null && String(row.periodIndex) === nowPeriod ? (
                        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true" title="Current time">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                        </span>
                      ) : null}
                      {formatRange(row.startMin, row.endMin)}
                    </span>
                  </th>
                  {DAYS.map((day) => {
                    const entry = entryByKey.get(`${day}:${row.periodIndex}`) ?? null;
                    const isNow = nowKey === `${day}:${row.periodIndex}`;
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
                    const approved = entry.status === "APPROVED";
                    const statusName = approved ? "approved" : "submitted";
                    const label = `${timeLabel}, ${entry.subject.name} with ${entry.section.name} (${statusName})${isNow ? ", current class" : ""}`;
                    return (
                      <td key={day} className="border-t p-1">
                        <div className="relative">
                          <div
                            aria-label={label}
                            title={`${entry.subject.name} — ${entry.section.name} (${statusName})${isNow ? " — current class" : ""}`}
                            className={`flex min-h-14 w-full items-center justify-center rounded-md border border-solid px-1 py-1 text-center text-xs transition-colors ${
                              isNow
                                ? "border-green-500 bg-green-500/10 ring-2 ring-green-500"
                                : "bg-primary/5"
                            }`}
                          >
                            <span className="flex min-w-0 max-w-full flex-col items-center leading-tight">
                              <span className="w-full truncate font-medium">
                                {entry.subject.name}
                              </span>
                              <span className="w-full truncate text-[11px] font-normal text-muted-foreground">
                                {entry.section.name}
                              </span>
                            </span>
                          </div>
                          <span
                            aria-hidden="true"
                            title={statusName}
                            className={`absolute bottom-1.5 left-1.5 h-1.5 w-1.5 rounded-full ${approved ? "bg-green-500" : "bg-blue-500"}`}
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
