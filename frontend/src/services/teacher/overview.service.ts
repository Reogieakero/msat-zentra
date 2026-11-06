"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useTerm } from "@/lib/term/TermContext";
import { writeCachedAdviser, writeCachedMasterTeacher } from "./flagCache";
import type {
  TeacherOverviewCritical,
  TeacherOverviewGradebook,
  TeacherOverviewInsights,
  TeacherOverviewSecondary,
} from "./overview.types";

const OVERVIEW_STALE_MS = 30_000;
const OVERVIEW_GC_MS = 5 * 60_000;

export async function fetchTeacherOverview(): Promise<TeacherOverviewCritical> {
  const { data } = await apiClient.get<TeacherOverviewCritical>(
    "/api/teacher/overview?scope=critical&atRiskOnly=1",
  );
  return data;
}

export async function fetchTeacherOverviewSecondary(): Promise<TeacherOverviewSecondary> {
  const { data } = await apiClient.get<TeacherOverviewSecondary>(
    "/api/teacher/overview?scope=secondary",
  );
  return data;
}

export async function fetchTeacherOverviewGradebook(): Promise<TeacherOverviewGradebook> {
  const { data } = await apiClient.get<TeacherOverviewGradebook>(
    "/api/teacher/overview?scope=gradebook",
  );
  return data;
}

export function teacherOverviewKey(
  teacherId: string | null | undefined,
  termKey = ""
) {
  return ["teacher-overview", teacherId ?? "anon", termKey] as const;
}

export function teacherOverviewSecondaryKey(
  teacherId: string | null | undefined,
  termKey = ""
) {
  return ["teacher-overview-secondary", teacherId ?? "anon", termKey] as const;
}

export function teacherOverviewGradebookKey(
  teacherId: string | null | undefined,
  termKey = ""
) {
  return ["teacher-overview-gradebook", teacherId ?? "anon", termKey] as const;
}

export function teacherOverviewInsightsKey(
  teacherId: string | null | undefined,
  termKey = "",
  days = 14,
) {
  return ["teacher-overview-insights", teacherId ?? "anon", termKey, days] as const;
}

export function useTeacherOverview() {
  const session = useSession();
  const { activeTerm } = useTerm();
  const teacherId = session?.sub ?? null;
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useQuery<TeacherOverviewCritical>({
    queryKey: teacherOverviewKey(teacherId, termKey),
    queryFn: async () => {
      const payload = await fetchTeacherOverview();
      writeCachedMasterTeacher(
        teacherId,
        payload.isMasterTeacher || payload.isMasterTeacherSenior,
      );
      writeCachedAdviser(teacherId, payload.isAdviser);
      return payload;
    },
    enabled: !!teacherId,
    staleTime: OVERVIEW_STALE_MS,
    gcTime: OVERVIEW_GC_MS,
  });
}

export function useTeacherOverviewGradebook() {
  const session = useSession();
  const { activeTerm } = useTerm();
  const teacherId = session?.sub ?? null;
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useQuery({
    queryKey: teacherOverviewGradebookKey(teacherId, termKey),
    queryFn: fetchTeacherOverviewGradebook,
    enabled: !!teacherId,
    staleTime: OVERVIEW_STALE_MS,
    gcTime: OVERVIEW_GC_MS,
    placeholderData: (previous) => previous,
  });
}

export async function fetchTeacherOverviewInsights(days = 14): Promise<TeacherOverviewInsights> {
  const { data } = await apiClient.get<TeacherOverviewInsights>(
    `/api/teacher/overview/insights?days=${days}`,
  );
  return data;
}

/**
 * Day-by-day risk + attendance series for the overview charts. Same term
 * scope as the overview itself (x-term-id headers ride on apiClient).
 */
export function useTeacherOverviewInsights(days = 14, enabled = true) {
  const session = useSession();
  const { activeTerm } = useTerm();
  const teacherId = session?.sub ?? null;
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useQuery<TeacherOverviewInsights>({
    queryKey: teacherOverviewInsightsKey(teacherId, termKey, days),
    queryFn: () => fetchTeacherOverviewInsights(days),
    enabled: enabled && !!teacherId,
    staleTime: OVERVIEW_STALE_MS,
    gcTime: OVERVIEW_GC_MS,
    placeholderData: (previous) => previous,
  });
}

export function useTeacherOverviewSecondary(enabled: boolean) {
  const session = useSession();
  const { activeTerm } = useTerm();
  const teacherId = session?.sub ?? null;
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useQuery({
    queryKey: teacherOverviewSecondaryKey(teacherId, termKey),
    queryFn: fetchTeacherOverviewSecondary,
    enabled: enabled && !!teacherId,
    staleTime: OVERVIEW_STALE_MS,
    gcTime: OVERVIEW_GC_MS,
    placeholderData: (previous) => previous,
  });
}
