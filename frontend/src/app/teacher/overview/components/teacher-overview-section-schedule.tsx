"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpenText, CalendarDays, Clock3, Hourglass, UserRound } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import {
  buildTimetable,
  formatRange,
  type DayConfig,
} from "@/app/teacher/schedule/components/schedule-time";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { WEEK_LABELS_FULL } from "@/services/teacher/schedule";
import { useAdvisorySections } from "@/services/teacher/advisory.service";
import { useTerm } from "@/lib/term/TermContext";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import kanban from "./advisory-schedule-kanban.module.css";

const KANBAN_DAYS = [1, 2, 3, 4, 5];

interface ScheduleEntry {
  day: number;
  period: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  subject: { id: string; name: string; code: string };
  teacherName?: { id: string; name: string } | null;
}

interface ScheduleSectionRow {
  id: string;
  name: string;
  timetableEntries: ScheduleEntry[];
}

export function AdvisorySectionSchedule({ onEmptyChange }: { onEmptyChange?: (empty: boolean) => void }) {
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  // Lightweight, term-scoped section lookup (single Section query). The old
  // code blocked on useTeacherOverview + useAdvisoryRoster — both fan out to
  // grades/attendance/risk queries — before even starting the schedule fetch.
  const sectionsQuery = useAdvisorySections();
  const section = sectionsQuery.data?.advisorySections?.[0] ?? null;
  const stillResolvingSection = !termReady || sectionsQuery.isPending;

  const [nowTick, setNowTick] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const schedQuery = useQuery<{ sections: ScheduleSectionRow[] }>({
    queryKey: ["teacher-schedule-section", section?.id ?? "none", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ sections: ScheduleSectionRow[] }>(
        `/api/teacher/schedule?sectionId=${encodeURIComponent(section?.id ?? "")}`,
      );
      return data;
    },
    enabled: !!section?.id && termReady,
    retry: false,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });
  const configQuery = useQuery<{ config: DayConfig }>({
    queryKey: ["teacher-schedule-config", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ config: DayConfig }>(
        "/api/teacher/schedule/config",
      );
      return data;
    },
    enabled: termReady,
    retry: false,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });
  const live = schedQuery.data?.sections.find((s) => s.id === section?.id) ?? null;
  const slots = !section
    ? []
    : (live?.timetableEntries ?? [])
        .filter((e) => e.status !== "DRAFT")
        .map((e) => ({
          day: e.day,
          period: e.period,
          status: e.status,
          subject: e.subject,
          teacherName: e.teacherName ?? null,
          section: { id: section.id, name: section.name, gradeLevel: section.gradeLevel },
        }));
  const config = configQuery.data?.config ?? null;
  const loaded =
    termReady &&
    !sectionsQuery.isPending &&
    !!section &&
    !schedQuery.isPending &&
    !schedQuery.isError &&
    !configQuery.isPending &&
    !!config;
  const isEmpty = loaded && slots.length === 0;
  const isBlank = termReady && !stillResolvingSection && (!section || isEmpty);
  React.useEffect(() => {
    onEmptyChange?.(isBlank);
  }, [isBlank, onEmptyChange]);

  const nowKey = React.useMemo(() => {
    if (!config) return null;

    void nowTick;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const dayMap: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };
    const day = dayMap[get("weekday")] ?? 0;
    if (day < 1 || day > 5) return null;
    const mins = Number(get("hour")) * 60 + Number(get("minute"));
    const row = buildTimetable(config).find(
      (r) => r.kind === "period" && mins >= r.startMin && mins < r.endMin,
    );
    if (!row || row.kind !== "period") return null;
    return `${day}:${row.periodIndex}`;
  }, [config, nowTick]);

  if (stillResolvingSection) {
    return (
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        aria-busy="true"
        aria-label="Loading class schedule"
      >
        {KANBAN_DAYS.map((day, colIndex) => (
          <div
            key={day}
            className={`flex flex-col gap-2 rounded-xl border border-border p-2.5 ${kanban.skeletonColumn}`}
            style={{ "--col-index": colIndex } as React.CSSProperties}
          >
            <div className={`h-5 w-24 rounded-md bg-muted ${kanban.skeleton}`} />
            {[0, 1, 2].map((i) => (
              <div key={i} className={`h-24 rounded-lg bg-muted ${kanban.skeleton}`} style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (!section) {
    const termLabel = activeTerm
      ? `${activeTerm.schoolYearName} · Term ${activeTerm.termNumber}`
      : "the selected term";
    return (
      <div className="flex min-h-[calc(100dvh-8rem)] w-full items-center justify-center" aria-label="Advisory class schedule">
        <div className={`${assign.card} w-full max-w-md`}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex flex-col items-center gap-2 py-6 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
              aria-hidden="true"
            >
              <CalendarDays size={24} className="text-muted-foreground" />
            </span>
            <p className="font-medium">No advisory section for {termLabel}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              This page shows the timetable of your advisory section only. A class schedule can
              exist for a section without you being its adviser — ask the master teacher or
              registrar to set you as adviser of that section (Section.adviserId), then reload.
            </p>
            {sectionsQuery.isError ? (
              <p role="alert" className="max-w-sm text-xs text-destructive">
                Could not verify your advisory assignment. Check your connection and reload.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const scheduleEmpty =
    !schedQuery.isPending &&
    !configQuery.isPending &&
    !!config &&
    !schedQuery.isError &&
    !!live &&
    slots.length === 0;
  if (scheduleEmpty) {
    return (
      <div className="flex min-h-[calc(100dvh-8rem)] w-full items-center justify-center" aria-label="Advisory class schedule">
        <div className={`${assign.card} w-full max-w-md`}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex flex-col items-center gap-2 py-6 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
              aria-hidden="true"
            >
              <CalendarDays size={24} className="text-muted-foreground" />
            </span>
            <p className="font-medium">No published schedule for {section.name} yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Your weekly timetable will appear here once the master teacher publishes it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section aria-label="Advisory class schedule" className="flex min-w-0 flex-col gap-3">
      {schedQuery.isPending || configQuery.isPending || !config ? (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          aria-busy="true"
          aria-label="Loading class schedule"
        >
          {KANBAN_DAYS.map((day, colIndex) => (
            <div
              key={day}
              className={`flex flex-col gap-2 rounded-xl border border-border p-2.5 ${kanban.skeletonColumn}`}
              style={{ "--col-index": colIndex } as React.CSSProperties}
            >
              <div className={`h-5 w-24 rounded-md bg-muted ${kanban.skeleton}`} />
              {[0, 1, 2].map((i) => (
                <div key={i} className={`h-24 rounded-lg bg-muted ${kanban.skeleton}`} style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
          ))}
        </div>
      ) : schedQuery.isError || !live ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load the section schedule.
        </p>
      ) : (
        <AdvisoryWeekKanban
          key={`${termKey}:${section?.id}`}
          slots={slots}
          config={config}
          nowKey={nowKey}
        />
      )}
    </section>
  );
}

function AdvisoryWeekKanban({
  slots,
  config,
  nowKey = null,
}: {
  slots: Array<{
    day: number;
    period: number;
    status: "DRAFT" | "SUBMITTED" | "APPROVED";
    subject: { id: string; name: string; code: string };
    teacherName?: { id: string; name: string } | null;
    section: { id: string; name: string; gradeLevel: string };
  }>;
  config: DayConfig;
  nowKey?: string | null;
}) {
  const timetable = React.useMemo(() => buildTimetable(config), [config]);
  const timeByPeriod = React.useMemo(() => {
    const map = new Map<number, { startMin: number; endMin: number }>();
    for (const row of timetable) {
      if (row.kind === "period") map.set(row.periodIndex, { startMin: row.startMin, endMin: row.endMin });
    }
    return map;
  }, [timetable]);

  return (
    <div
      className={`grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 ${kanban.view}`}
      aria-label="Weekly schedule by day"
    >
      {KANBAN_DAYS.map((day, colIndex) => {
        const daySlots = slots
          .filter((s) => s.day === day)
          .slice()
          .sort((a, b) => a.period - b.period);

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
                  const range = t ? formatRange(t.startMin, t.endMin) : `Period ${entry.period + 1}`;
                  const mins = t ? t.endMin - t.startMin : 0;
                  const isNow = nowKey === `${entry.day}:${entry.period}`;
                  const teacherLabel = entry.teacherName?.name?.trim() ? entry.teacherName.name : "Unassigned";
                  const label = `${WEEK_LABELS_FULL[day - 1]} ${range}, ${entry.subject.name} (${entry.subject.code}), ${mins} minutes, ${teacherLabel}${isNow ? ", current class" : ""}`;
                  return (
                    <article
                      key={`${entry.day}:${entry.period}`}
                      aria-label={label}
                      title={`${entry.subject.name} — ${range}`}
                      style={{ "--col-index": colIndex, "--card-index": cardIndex } as React.CSSProperties}
                      className={`relative flex flex-col gap-1.5 rounded-lg border p-2.5 text-left ${kanban.card} ${
                        isNow
                          ? `border-green-500 bg-green-500/10 ring-2 ring-green-500 ${kanban.cardNow}`
                          : "border-input bg-card hover:border-amber-500/60"
                      }`}
                    >
                      {isNow ? (
                        <span className="inline-flex w-fit items-center gap-1 rounded-md border border-green-500/40 bg-green-500/10 px-1.5 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400">
                          <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                          </span>
                          Now
                        </span>
                      ) : null}
                      <span className="flex items-start gap-1.5">
                        <BookOpenText size={14} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
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
                        <span className="inline-flex w-fit items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                          <Hourglass size={11} aria-hidden="true" />
                          {mins > 0 ? `${mins} min` : "—"}
                        </span>
                        <span className="flex justify-end">
                          <span
                            className="inline-flex max-w-full items-center gap-1 truncate rounded-md border border-input bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium text-foreground"
                            title={teacherLabel}
                          >
                            <UserRound size={11} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="truncate">{teacherLabel}</span>
                          </span>
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
