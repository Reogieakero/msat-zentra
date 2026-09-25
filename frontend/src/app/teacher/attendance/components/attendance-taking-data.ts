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
export type SheetSession = "AM" | "PM";

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
 *  caller's advisory sections, so teacher + date + session fully determines
 *  the payload — no section can leak across teachers or days. */
export function sheetMarksKey(
  teacherId: string | null | undefined,
  date: string,
  session: SheetSession,
) {
  return ["attendance-sheet-marks", teacherId ?? "anon", date, session] as const;
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

/** Submitted marks for one date + session. keepPreviousData keeps the last
 *  sheet visible while a new date/session loads instead of flashing a
 *  full skeleton. */
export function useSheetMarks(date: string, session: SheetSession) {
  const auth = useSession();
  const teacherId = auth?.sub ?? null;
  return useQuery({
    queryKey: sheetMarksKey(teacherId, date, session),
    queryFn: () => fetchSheetMarks(`${date}T00:00:00Z`, session),
    enabled: !!teacherId,
    staleTime: SHEET_STALE_MS,
    gcTime: SHEET_GC_MS,
    placeholderData: keepPreviousData,
  });
}

export async function fetchSheetMarks(
  dateISO: string,
  session: SheetSession
): Promise<Record<string, SheetStatus>> {
  const params = new URLSearchParams({ date: dateISO, session });
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
  session: SheetSession;
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
