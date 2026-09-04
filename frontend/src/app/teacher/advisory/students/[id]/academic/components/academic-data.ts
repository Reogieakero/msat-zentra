import { apiClient } from "@/lib/api/client";

export interface AcademicGrade {
  subject: string;
  computedAverage: number | null;
  transmutedGrade: number | null;
  remarks: string | null;
  lockStatus: string | null;
}

export interface AcademicSummary {
  subjects: number;
  graded: number;
  passed: number;
  failed: number;
  average: number | null;
}

export interface StudentAcademic {
  student: {
    studentId: string;
    name: string;
    lrn: string;
    section: string;
  };
  grades: AcademicGrade[];
  summary: AcademicSummary;
}

export async function fetchStudentAcademic(studentId: string): Promise<StudentAcademic> {
  const { data } = await apiClient.get<StudentAcademic>(
    `/api/teacher/advisory/students/${studentId}/academic`
  );
  return data;
}

export type GradeVersion = "computed" | "final";

export const VERSION_LABELS: Record<GradeVersion, string> = {
  computed: "Computed",
  final: "Final",
};

export function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
