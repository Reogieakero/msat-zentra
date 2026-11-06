import { apiClient } from "@/lib/api/client";
import type { StudentAttendance } from "./adviseeAttendance.types";

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
