"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useTerm } from "@/lib/term/TermContext";
import { writeCachedAdviser, writeCachedMasterTeacher } from "./flagCache";
import type {
  TeacherOverviewCritical,
  TeacherOverviewGradebook,
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

export function useTeacherOverview() {
  const session = useSession();
  const { activeTerm } = useTerm();
  const teacherId = session?.sub ?? null;
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useQuery<TeacherOverviewCritical>({
    queryKey: teacherOverviewKey(teacherId, termKey),
    queryFn: async () => {
      const payload = await fetchTeacherOverview();
      writeCachedMasterTeacher(teacherId, payload.isMasterTeacher);
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
