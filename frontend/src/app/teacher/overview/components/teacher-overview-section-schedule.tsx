"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import {
  buildTimetable,
  type DayConfig,
} from "@/app/teacher/schedule/components/schedule-time";
import { MyWeekGrid, type MyWeekSlot } from "@/app/teacher/classes/components/MyWeekGrid";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import { useTerm } from "@/lib/term/TermContext";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./teacher-overview-advisory.module.css";

interface ScheduleEntry {
  day: number;
  period: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  subject: { id: string; name: string; code: string };
}

interface ScheduleSectionRow {
  id: string;
  name: string;
  timetableEntries: ScheduleEntry[];
}

export function AdvisorySectionSchedule() {
  const overview = useTeacherOverview();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const section = overview.data?.advisorySection ?? null;

  const [nowTick, setNowTick] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const schedQuery = useQuery<{ sections: ScheduleSectionRow[] }>({
    queryKey: ["teacher-schedule", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ sections: ScheduleSectionRow[] }>(
        "/api/teacher/schedule",
      );
      return data;
    },
    enabled: !!section,
    retry: false,
  });
  const configQuery = useQuery<{ config: DayConfig }>({
    queryKey: ["teacher-schedule-config", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ config: DayConfig }>(
        "/api/teacher/schedule/config",
      );
      return data;
    },
    enabled: !!section,
    retry: false,
  });
  const live = schedQuery.data?.sections.find((s) => s.id === section?.id) ?? null;
  const slots: MyWeekSlot[] = !section
    ? []
    : (live?.timetableEntries ?? [])
    .filter((e) => e.status !== "DRAFT")
    .map((e) => ({
      day: e.day,
      period: e.period,
      status: e.status,
      subject: e.subject,
      section: { id: section.id, name: section.name, gradeLevel: section.gradeLevel },
    }));
  const config = configQuery.data?.config ?? null;

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

  if (!section) return null;

  return (
    <section aria-label="Advisory class schedule" className="flex min-w-0 flex-col gap-3">
      <div className={assign.card}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        {schedQuery.isPending || configQuery.isPending || !config ? (
          <div
            className="relative flex flex-col gap-2"
            aria-busy="true"
            aria-label="Loading class schedule"
          >
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-md bg-muted" />
            ))}
          </div>
        ) : schedQuery.isError || !live ? (
          <p role="alert" className="relative text-sm text-destructive">
            Could not load the section schedule.
          </p>
        ) : slots.length === 0 ? (
          <p className={`${styles.empty} relative`}>No published schedule for {section.name} yet.</p>
        ) : (
          <div className="relative min-w-0">
            <MyWeekGrid slots={slots} config={config} nowKey={nowKey} />
          </div>
        )}
      </div>
    </section>
  );
}
