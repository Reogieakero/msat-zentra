import { apiClient } from "@/lib/api/client";

export interface AnecdotalFollowup {
  id: string;
  by: string;
  date: string;
  notes: string;
}

export interface AnecdotalRecord {
  id: string;
  observationDatetime: string;
  category: string;
  confidentialityLevel: string;
  mine: boolean;
  location?: string | null;
  incident?: string;
  notes?: string | null;
  classPerformance?: string | null;
  attendanceSummary?: string | null;
  followups?: AnecdotalFollowup[];
  followupCount?: number;
}

export interface StudentAnecdotal {
  student: {
    studentId: string;
    name: string;
    lrn: string;
    section: string;
  };
  records: AnecdotalRecord[];
}

export async function fetchStudentAnecdotal(studentId: string): Promise<StudentAnecdotal> {
  const { data } = await apiClient.get<StudentAnecdotal>(
    `/api/teacher/advisory/students/${studentId}/anecdotal`
  );
  return data;
}

export function formatRecordDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Mirrors the backend CATEGORY_META colors in anecdotal.routes.ts.
export const CATEGORY_COLORS: Record<string, string> = {
  behavioral: "#166534",
  bullying: "#b91c1c",
  academic: "#1d4ed8",
  attendance: "#c2410c",
  health: "#7c3aed",
};

export function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
