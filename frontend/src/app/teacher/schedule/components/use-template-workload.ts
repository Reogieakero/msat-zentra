"use client";
import { useCallback, useState } from "react";
import { DEFAULT_WORKLOAD, type WorkloadConfig } from "./schedule-time";

function keyFor(termKey: string): string {
  return `zentra.schedule-workload:${termKey}`;
}

function readStored(termKey: string): WorkloadConfig {
  if (typeof window === "undefined" || !termKey || termKey === ":") return { ...DEFAULT_WORKLOAD };
  try {
    const raw = localStorage.getItem(keyFor(termKey));
    if (!raw) return { ...DEFAULT_WORKLOAD };
    const parsed = JSON.parse(raw) as Partial<WorkloadConfig>;
    return {
      maxDailyPeriods:
        typeof parsed.maxDailyPeriods === "number" ? parsed.maxDailyPeriods : DEFAULT_WORKLOAD.maxDailyPeriods,
      maxWeeklyPeriods:
        typeof parsed.maxWeeklyPeriods === "number" ? parsed.maxWeeklyPeriods : DEFAULT_WORKLOAD.maxWeeklyPeriods,
    };
  } catch {
    return { ...DEFAULT_WORKLOAD };
  }
}

export function useTemplateWorkload(termKey: string) {
  const [workload, setWorkloadState] = useState<WorkloadConfig>(() => readStored(termKey));

  const setWorkload = useCallback(
    (next: WorkloadConfig) => {
      const capped: WorkloadConfig = {
        maxDailyPeriods: Math.min(8, Math.max(1, Math.round(next.maxDailyPeriods) || 6)),
        maxWeeklyPeriods: Math.min(40, Math.max(1, Math.round(next.maxWeeklyPeriods) || 30)),
      };
      setWorkloadState(capped);
      try {
        if (termKey && termKey !== ":") localStorage.setItem(keyFor(termKey), JSON.stringify(capped));
      } catch {
        // ignore quota errors
      }
    },
    [termKey],
  );

  return { workload, setWorkload };
}
