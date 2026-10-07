// Advisee academic-detail shapes. Pure types only.
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

export type GradeVersion = "computed" | "final";

export const VERSION_LABELS: Record<GradeVersion, string> = {
  computed: "Computed",
  final: "Final",
};
