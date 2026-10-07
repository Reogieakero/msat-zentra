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
    // Account status never excludes anyone: enlisted students without logins
    // take attendance under their `roster:<id>` key, which the backend
    // persists against the roster entry.
    students: roster.students.map((s) => ({
      studentId: s.studentId,
      name: s.name,
      lrn: s.lrn,
      attendanceRate: s.attendanceRate,
    })),
  };
}

// Same lifetime as the roster entry below (stale 30s, gc 5min). Prefix
// invalidations on ["attendance-sheet-marks"] still match scoped keys.
const SHEET_STALE_MS = 30_000;
const SHEET_GC_MS = 5 * 60_000;

/** Teacher + term scoped marks key. The endpoint already scopes server-side
 *  to the caller's sections, so teacher + term + date + section + subject +
 *  slot fully determines the payload — no section can leak across teachers,
 *  terms, days, sections, or subjects. */
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

/** Subjects offered in a section+term (assignment-backed) — the only valid
 *  subjectId values for submitSheet. */
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
    // Card switches keep the previous sheet's subjects while the new
    // section loads — no skeleton flash mid-navigation.
    placeholderData: keepPreviousData,
  });
}

/** Advisory section discovery (section id/name/term) from the SHARED roster
 *  entry — used ONLY to find which section a pair belongs to. The sheet's
 *  STUDENT LIST never comes from here; it always comes from
 *  useSectionRoster(sectionId) (GET /api/attendance/section-roster), i.e. the
 *  section's enlisted students per subject, not the advisory list. */
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

/** Submitted marks for one section + date + subject + slot (per-subject
 *  sheet). keepPreviousData keeps the last sheet visible while a new
 *  date/section/subject loads instead of flashing a full skeleton. */
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
    // Same keep-previous contract as the sheet marks: switching cards
    // repaints the meetup blocks in place instead of blanking them.
    placeholderData: keepPreviousData,
  });
}

/** Meetup dates across the term: every school day whose weekday is one of
 *  the subject's meetup days. Capped so the strip stays renderable. */
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
    const dow = d.getUTCDay(); // 0 = Sun … 6 = Sat
    const day = dow === 0 ? 7 : dow; // 1 = Mon … 7 = Sun
    if (meetupDays.includes(day)) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Meetup date keys for one section + subject — the single source for the
 *  sheet blocks view AND the navbar sheet date picker, so both agree on
 *  which dates are markable. `dateKeys` is null until the term range loads
 *  (pickers fall back to future-only disabling while null). */
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
    // Card switches keep the previous section's students on screen while
    // the new roster loads — the sheet never blanks to skeleton between
    // two cached-or-fetching sections.
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

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Philippines calendar day — matches the backend lock clock.
export function phTodayKey(): string {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
}

function mondayOf(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 86_400_000).toISOString().slice(0, 10);
}

// Editable when the date falls in the current Mon–Sun week (same-week grace).
export function isEditableDay(dateKey: string): boolean {
  return mondayOf(dateKey) === mondayOf(phTodayKey());
}
