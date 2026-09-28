import { apiClient } from "@/lib/api/client";

export interface SubjectMark {
  status: string;
  slot: number;
  name: string;
  code: string;
}

export interface AttendanceDay {
  date: string;
  sessions: Record<string, string>;
  subjects?: Record<string, SubjectMark>;
}

export interface SubjectBreakdown {
  subjectId: string;
  name: string;
  code: string;
  present: number;
  total: number;
  rate: number;
}

export interface SubjectAttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  rate: number;
  isRisk: boolean;
  bySubject: SubjectBreakdown[];
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  schoolDays: number;
  rate: number;
  isRisk: boolean;
}

export interface StudentAttendance {
  student: {
    studentId: string;
    name: string;
    lrn: string;
    section: string;
  };
  summary: AttendanceSummary;
  /** Null until the student has subject-era rows — legacy AM/PM only. */
  subjectSummary: SubjectAttendanceSummary | null;
  termStart: string | null;
  days: AttendanceDay[];
}

export async function fetchStudentAttendance(studentId: string): Promise<StudentAttendance> {
  const { data } = await apiClient.get<StudentAttendance>(
    `/api/teacher/advisory/students/${studentId}/attendance`
  );
  return data;
}

export function formatDayDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
