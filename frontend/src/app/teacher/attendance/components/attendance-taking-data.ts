import { apiClient } from "@/lib/api/client";
import { fetchAdvisoryRoster } from "../../advisory/students/components/advisory-students-data";

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

export async function fetchSheetContext(): Promise<SheetContext> {
  const roster = await fetchAdvisoryRoster();
  const section = roster.advisorySections[0];
  if (!section || !roster.termId) {
    throw new Error("No advisory section assigned");
  }
  return {
    sectionId: section.id,
    sectionName: section.name,
    termId: roster.termId,
    students: roster.students
      .filter((s) => s.hasAccount)
      .map((s) => ({
        studentId: s.studentId,
        name: s.name,
        lrn: s.lrn,
        attendanceRate: s.attendanceRate,
      })),
  };
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
