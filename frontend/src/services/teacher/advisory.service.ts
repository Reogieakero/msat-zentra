"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useTerm } from "@/lib/term/TermContext";
import type { AdviseeDetail, AdviseeRow, AdvisoryRoster } from "./advisory.types";

export async function fetchAdvisoryRoster(): Promise<AdvisoryRoster> {
  const { data } = await apiClient.get<AdvisoryRoster>("/api/teacher/advisory/students");
  return data;
}

const ROSTER_STALE_MS = 30_000;
const ROSTER_GC_MS = 5 * 60_000;

export function advisoryRosterKey(
  teacherId: string | null | undefined,
  termKey = ""
) {
  return ["advisory-students", teacherId ?? "anon", termKey] as const;
}

export function useAdvisoryRoster() {
  const session = useSession();
  const { activeTerm, termReady } = useTerm();
  const teacherId = session?.sub ?? null;
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useQuery<AdvisoryRoster>({
    queryKey: advisoryRosterKey(teacherId, termKey),
    queryFn: fetchAdvisoryRoster,
    enabled: !!teacherId && termReady,
    retry: false,
    staleTime: ROSTER_STALE_MS,
    gcTime: ROSTER_GC_MS,
  });
}

export async function fetchAdviseeDetail(studentId: string): Promise<AdviseeDetail> {
  const { data } = await apiClient.get<AdviseeDetail>(
    `/api/teacher/advisory/students/${studentId}`
  );
  return data;
}

export async function enlistStudent(payload: { fullName: string; lrn: string }): Promise<AdviseeRow> {
  const { data } = await apiClient.post<AdviseeRow>("/api/teacher/advisory/roster", payload);
  return data;
}

export function formatBirthdate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
