"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import {
  advisoryRosterKey,
  fetchAdvisoryRoster,
  type AdvisoryRoster,
} from "../../advisory/students/components/advisory-students-data";

export type SheetStatus = "present" | "absent" | "late" | "excused";
// NOTE: legacy AM/PM takes are archived (GET /api/attendance/legacy/days).
// New takes are keyed by (subjectId, slot) — no session type remains here.

export interface OfferedSubject {
  assignmentId: string;
  subjectId: string;
  code: string;
  name: string;
  gradeLevel: string;
  teacherId: string;
  teacherName: string;
  canMark: boolean;
}

export interface SheetStudent {
  studentId: string;
  name: string;
  lrn: string;
  attendanceRate: number;
}

export interface SheetContext {
  sectionId: string;
  sectionName: string;
  termId: string;
  students: SheetStudent[];
}

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

/** Teacher-scoped marks key. The endpoint already scopes server-side to the
 *  caller's sections, so teacher + date + section + subject + slot fully
 *  determines the payload — no section can leak across teachers, days,
 *  sections, or subjects. */
export function sheetMarksKey(
  teacherId: string | null | undefined,
  date: string,
  subjectId: string,
  slot: number,
  sectionId?: string | null,
) {
  return ["attendance-sheet-marks", teacherId ?? "anon", date, sectionId ?? "all", subjectId, slot] as const;
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
  });
}

/** Sheet context derived from the SHARED roster entry — the rail, the sheet,
 *  and the students page all read one cached roster per teacher. */
export function useSheetContext() {
  const session = useSession();
  const teacherId = session?.sub ?? null;
  return useQuery({
    queryKey: advisoryRosterKey(teacherId),
    queryFn: fetchAdvisoryRoster,
    enabled: !!teacherId,
    retry: false,
    staleTime: SHEET_STALE_MS,
    gcTime: SHEET_GC_MS,
    select: toSheetContext,
  });
}

/** Submitted marks for one date + section + subject + slot. keepPreviousData
 *  keeps the last sheet visible while a new date/section/subject loads
 *  instead of flashing a full skeleton. */
export function useSheetMarks(
  date: string,
  subjectId: string | undefined,
  slot: number,
  sectionId?: string | null,
) {
  const auth = useSession();
  const teacherId = auth?.sub ?? null;
  return useQuery({
    queryKey: sheetMarksKey(teacherId, date, subjectId ?? "none", slot, sectionId ?? null),
    queryFn: () => fetchSheetMarks(`${date}T00:00:00Z`, subjectId as string, slot),
    enabled: !!teacherId && !!subjectId,
    staleTime: SHEET_STALE_MS,
    gcTime: SHEET_GC_MS,
    placeholderData: keepPreviousData,
  });
}

/** Term-scoped per-day subject marks for the meetup blocks view. */
export interface SubjectDayRecord {
  key: string;
  date: string; // UTC day key
  status: SheetStatus;
}

export interface SubjectDays {
  sectionId: string;
  subjectId: string;
  termId: string;
  termStart: string | null;
  termEnd: string | null;
  records: SubjectDayRecord[];
}

export function subjectDaysKey(
  sectionId: string | undefined,
  subjectId: string | undefined,
  mine = false,
) {
  return [
    "attendance-subject-days",
    sectionId ?? "none",
    subjectId ?? "none",
    mine ? "mine" : "all",
  ] as const;
}

export function useSubjectDays(
  sectionId: string | undefined,
  subjectId: string | undefined,
  mine = false,
) {
  return useQuery({
    queryKey: subjectDaysKey(sectionId, subjectId, mine),
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
  });
}

/** Roster for one section the caller may serve (advisory, assignments, or
 *  code-linked timetable slots) — drives code-claimed per-subject sheets. */
export interface SectionRoster {
  sectionId: string;
  sectionName: string;
  termId: string;
  students: SheetStudent[];
}

export function sectionRosterKey(sectionId: string | undefined) {
  return ["attendance-section-roster", sectionId ?? "none"] as const;
}

export function useSectionRoster(sectionId: string | undefined) {
  return useQuery({
    queryKey: sectionRosterKey(sectionId),
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
  });
}

export async function fetchSheetMarks(
  dateISO: string,
  subjectId: string,
  slot: number,
): Promise<Record<string, SheetStatus>> {
  const params = new URLSearchParams({ date: dateISO, subjectId, slot: String(slot) });
  const { data } = await apiClient.get<{ marks: { studentId: string; status: SheetStatus }[] }>(
    `/api/teacher/advisory/attendance?${params.toString()}`
  );
  const map: Record<string, SheetStatus> = {};
  for (const m of data.marks) map[m.studentId] = m.status;
  return map;
}

export interface SubmitSheetPayload {
  sectionId: string;
  termId: string;
  date: string;
  subjectId: string;
  assignmentId?: string;
  slot: number;
  records: { studentId: string; status: SheetStatus }[];
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
