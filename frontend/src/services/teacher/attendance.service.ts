"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useTerm } from "@/lib/term/TermContext";
import {
  advisoryRosterKey,
  fetchAdvisoryRoster,
} from "@/services/teacher/advisory.service";
import type { AdvisoryRoster } from "@/services/teacher/advisory.types";
import type {
  OfferedSubject,
  SectionRoster,
  SheetContext,
  SheetStatus,
  SubjectDays,
  SubmitSheetPayload,
} from "./attendance.types";

function toSheetContext(roster: AdvisoryRoster): SheetContext {
  const section = roster.advisorySections[0];
  if (!section || !roster.termId) {
    throw new Error("No advisory section assigned");
  }
  return {
    sectionId: section.id,
    sectionName: section.name,
    termId: roster.termId,

    students: roster.students.map((s) => ({
      studentId: s.studentId,
      name: s.name,
      lrn: s.lrn,
      attendanceRate: s.attendanceRate,
    })),
  };
}

const SHEET_STALE_MS = 30_000;
const SHEET_GC_MS = 5 * 60_000;

export function sheetMarksKey(
  teacherId: string | null | undefined,
  date: string,
  subjectId: string,
  slot: number,
  sectionId?: string | null,
  termKey = "",
) {
  return ["attendance-sheet-marks", teacherId ?? "anon", termKey, date, sectionId ?? "all", subjectId, slot] as const;
}

export function offeredSubjectsKey(sectionId: string | undefined, termId: string | undefined) {
  return ["offered-subjects", sectionId ?? "none", termId ?? "none"] as const;
}

export async function fetchOfferedSubjects(
  sectionId: string,
  termId: string,
): Promise<OfferedSubject[]> {
  const params = new URLSearchParams({ sectionId, termId });
  const { data } = await apiClient.get<{ subjects: OfferedSubject[] }>(
    `/api/attendance/subjects?${params.toString()}`
  );
  return data.subjects;
}

export function useOfferedSubjects(sectionId: string | undefined, termId: string | undefined) {
  return useQuery({
    queryKey: offeredSubjectsKey(sectionId, termId),
    queryFn: () => fetchOfferedSubjects(sectionId as string, termId as string),
    enabled: !!sectionId && !!termId,
    retry: false,
    staleTime: SHEET_STALE_MS,
    gcTime: SHEET_GC_MS,

    placeholderData: keepPreviousData,
  });
}

export function useSheetContext() {
  const session = useSession();
  const { activeTerm } = useTerm();
  const teacherId = session?.sub ?? null;
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useQuery({
    queryKey: advisoryRosterKey(teacherId, termKey),
    queryFn: fetchAdvisoryRoster,
    enabled: !!teacherId,
    retry: false,
    staleTime: SHEET_STALE_MS,
    gcTime: SHEET_GC_MS,
    select: toSheetContext,
  });
}

export function useSheetMarks(
  date: string,
  subjectId: string | undefined,
  slot: number,
  sectionId?: string | null,
) {
  const auth = useSession();
  const { activeTerm } = useTerm();
  const teacherId = auth?.sub ?? null;
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useQuery({
    queryKey: sheetMarksKey(teacherId, date, subjectId ?? "none", slot, sectionId ?? null, termKey),
    queryFn: () =>
      fetchSheetMarks(`${date}T00:00:00Z`, subjectId as string, slot, sectionId ?? null),
    enabled: !!teacherId && !!subjectId && !!sectionId,
    staleTime: SHEET_STALE_MS,
    gcTime: SHEET_GC_MS,
    placeholderData: keepPreviousData,
  });
}

export function subjectDaysKey(
  sectionId: string | undefined,
  subjectId: string | undefined,
  mine = false,
  termKey = "",
) {
  return [
    "attendance-subject-days",
    sectionId ?? "none",
    subjectId ?? "none",
    mine ? "mine" : "all",
    termKey,
  ] as const;
}

export function useSubjectDays(
  sectionId: string | undefined,
  subjectId: string | undefined,
  mine = false,
) {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useQuery({
    queryKey: subjectDaysKey(sectionId, subjectId, mine, termKey),
    queryFn: async (): Promise<SubjectDays> => {
      const params = new URLSearchParams({
        sectionId: sectionId as string,
        subjectId: subjectId as string,
        ...(mine ? { mine: "1" } : {}),
      });
      const { data } = await apiClient.get<SubjectDays>(
        `/api/attendance/subject-days?${params.toString()}`,
      );
      return data;
    },
    enabled: !!sectionId && !!subjectId,
    retry: false,
    staleTime: SHEET_STALE_MS,
    gcTime: SHEET_GC_MS,

    placeholderData: keepPreviousData,
  });
}

export function enumerateMeetupDates(
  termStart: string | null,
  termEnd: string | null,
  meetupDays: number[],
): string[] {
  if (!termStart) return [];
  const start = new Date(`${termStart.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return [];
  const endRaw = termEnd ? new Date(`${termEnd.slice(0, 10)}T00:00:00Z`) : new Date();
  const end = new Date(`${endRaw.toISOString().slice(0, 10)}T00:00:00Z`);
  const out: string[] = [];
  for (let d = new Date(start); d <= end && out.length < 90; d = new Date(d.getTime() + 86_400_000)) {
    const dow = d.getUTCDay();
    const day = dow === 0 ? 7 : dow;
    if (meetupDays.includes(day)) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function useMeetupDates(
  sectionId: string | undefined,
  subjectId: string | undefined,
  meetupDays: number[],
) {
  const daysQuery = useSubjectDays(sectionId, subjectId);
  const dateKeys = useMemo(
    () =>
      daysQuery.data
        ? enumerateMeetupDates(
            daysQuery.data.termStart,
            daysQuery.data.termEnd,
            meetupDays,
          )
        : null,
    [daysQuery.data, meetupDays],
  );
  return {
    days: daysQuery.data,
    dateKeys,
    isPending: daysQuery.isPending,
    hasTerm: !!daysQuery.data?.termStart,
  };
}

export function sectionRosterKey(sectionId: string | undefined, termKey = "") {
  return ["attendance-section-roster", sectionId ?? "none", termKey] as const;
}

export function useSectionRoster(sectionId: string | undefined) {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useQuery({
    queryKey: sectionRosterKey(sectionId, termKey),
    queryFn: async (): Promise<SectionRoster> => {
      const params = new URLSearchParams({ sectionId: sectionId as string });
      const { data } = await apiClient.get<SectionRoster>(
        `/api/attendance/section-roster?${params.toString()}`,
      );
      return data;
    },
    enabled: !!sectionId,
    retry: false,
    staleTime: SHEET_STALE_MS,
    gcTime: SHEET_GC_MS,

    placeholderData: keepPreviousData,
  });
}

export async function fetchSheetMarks(
  dateISO: string,
  subjectId: string,
  slot: number,
  sectionId?: string | null,
): Promise<Record<string, SheetStatus>> {
  const params = new URLSearchParams({ date: dateISO, subjectId, slot: String(slot) });
  if (sectionId) params.set("sectionId", sectionId);
  const { data } = await apiClient.get<{ marks: { studentId: string; status: SheetStatus }[] }>(
    `/api/teacher/advisory/attendance?${params.toString()}`
  );
  const map: Record<string, SheetStatus> = {};
  for (const m of data.marks) map[m.studentId] = m.status;
  return map;
}

export async function submitSheet(payload: SubmitSheetPayload): Promise<{ count: number }> {
  const { data } = await apiClient.post<{ count: number }>("/api/attendance/bulk", payload);
  return data;
}

export function phTodayKey(): string {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
}

function mondayOf(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 86_400_000).toISOString().slice(0, 10);
}

export function isEditableDay(dateKey: string): boolean {
  return mondayOf(dateKey) === mondayOf(phTodayKey());
}
