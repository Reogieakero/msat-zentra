"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import type { TeacherReportsPayload, TeachingLoadSlot } from "./reports.types";

export async function fetchTeacherReports(): Promise<TeacherReportsPayload> {
  const { data } = await apiClient.get<TeacherReportsPayload>("/api/teacher/reports");
  return data;
}

export function teacherReportsKey(termKey: string) {
  return ["teacher-reports", termKey] as const;
}

/**
 * Term report for the signed-in teacher. The term rides on the global
 * `activeTerm` scope (sent as x-term-id by apiClient), so switching terms in
 * the scope bar refetches this query.
 */
export function useTeacherReports() {
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useQuery<TeacherReportsPayload>({
    queryKey: teacherReportsKey(termKey),
    queryFn: fetchTeacherReports,
    enabled: termReady,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    // No placeholderData: a report must never show one term's numbers under
    // another term's scope while the switch is loading.
    retry: false,
  });
}

export async function fetchTeachingLoad(): Promise<{ slots: TeachingLoadSlot[] }> {
  const { data } = await apiClient.get<{ slots: TeachingLoadSlot[] }>("/api/teacher/schedule/my-slots");
  return data;
}

export function useTeachingLoad() {
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useQuery<{ slots: TeachingLoadSlot[] }>({
    queryKey: ["teacher-my-slots", termKey],
    queryFn: fetchTeachingLoad,
    enabled: termReady,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: false,
  });
}
