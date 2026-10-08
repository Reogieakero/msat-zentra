"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { DayConfig } from "@/app/teacher/schedule/components/schedule-time";
export interface LinkedName {
  id: string;
  name: string;
  code: string | null;
}
export interface MySlot {
  day: number;
  period: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  subject: { id: string; name: string; code: string };
  section: { id: string; name: string; gradeLevel: string };
}
export interface AttendancePair {
  key: string;
  section: { id: string; name: string; gradeLevel: string | null };
  subject: { id: string; name: string; code: string } | null;
  slots: { day: number; period: number; status: "DRAFT" | "SUBMITTED" | "APPROVED" }[];
}
export function useAttendancePairs(termKey: string, linked: LinkedName | null, isMaster: boolean | undefined) {
  const mySlotsQuery = useQuery<{ slots: MySlot[] }>({
    queryKey: ["teacher-my-slots", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ slots: MySlot[] }>(
        "/api/teacher/schedule/my-slots",
      );
      return data;
    },
    enabled: linked !== null || isMaster,
  });
  const configQuery = useQuery<{ config: DayConfig }>({
    queryKey: ["teacher-schedule-config", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ config: DayConfig }>(
        "/api/teacher/schedule/config",
      );
      return data;
    },
  });
  const pairs = useMemo<AttendancePair[]>(() => {
    const list: AttendancePair[] = [];
    const byKey = new Map<string, AttendancePair>();
    const ordered = [...(mySlotsQuery.data?.slots ?? [])].sort(
      (a, b) => a.day - b.day || a.period - b.period,
    );
    for (const s of ordered) {
      const key = `${s.section.id}|${s.subject.id}`;
      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          key,
          section: { id: s.section.id, name: s.section.name, gradeLevel: s.section.gradeLevel },
          subject: { ...s.subject },
          slots: [],
        };
        byKey.set(key, entry);
        list.push(entry);
      }
      entry.slots.push({ day: s.day, period: s.period, status: s.status });
    }
    return list;
  }, [mySlotsQuery.data]);
  return { pairs, mySlotsQuery, configQuery };
}
