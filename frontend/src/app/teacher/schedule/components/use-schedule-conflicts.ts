"use client";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { WorkloadConfig } from "./schedule-time";

export interface TemplateConflict {
  teacherNameId: string;
  teacherName: string;
  day: number;
  period: number;
  sections: Array<{ sectionId: string; sectionName: string; subjectName: string }>;
}

export interface TemplateConflictsData {
  conflicts: TemplateConflict[];
  workload: {
    maxDailyPeriods: number;
    maxWeeklyPeriods: number;
    overDaily: Array<{ teacherNameId: string; day: number; count: number }>;
    overWeekly: Array<{ teacherNameId: string; teacherName: string; count: number }>;
  };
}

export function conflictKey(day: number, period: number, teacherNameId: string): string {
  return `${teacherNameId}:${day}:${period}`;
}

export function useScheduleConflicts(termKey: string, workload: WorkloadConfig, opts?: { enabled?: boolean }) {
  const query = useQuery<TemplateConflictsData>({
    queryKey: ["teacher-schedule-conflicts", termKey, workload.maxDailyPeriods, workload.maxWeeklyPeriods],
    queryFn: async () => {
      const { data } = await apiClient.get<TemplateConflictsData>("/api/teacher/schedule/conflicts", {
        params: {
          maxDailyPeriods: workload.maxDailyPeriods,
          maxWeeklyPeriods: workload.maxWeeklyPeriods,
        },
      });
      return data;
    },
    staleTime: 15_000,
    enabled: opts?.enabled ?? true,
  });

  const conflictedCells = new Set<string>();
  for (const c of query.data?.conflicts ?? []) {
    for (const s of c.sections) {
      void s;
      conflictedCells.add(conflictKey(c.day, c.period, c.teacherNameId));
    }
  }

  return { ...query, conflictedCells };
}
