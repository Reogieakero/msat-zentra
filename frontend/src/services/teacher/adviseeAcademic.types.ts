export interface AcademicGrade {
  subject: string;
  subjectId?: string;
  computedAverage: number | null;
  transmutedGrade: number | null;
  remarks: string | null;
  lockStatus: string | null;
  hiddenByTeacher?: boolean;
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
  hiddenCount?: number;
  summary: AcademicSummary;
}

export type GradeVersion = "computed" | "final";

export const VERSION_LABELS: Record<GradeVersion, string> = {
  computed: "Computed",
  final: "Final",
};
