import type { GradeLevel } from "../generated/prisma/client.js";

export const GRADE_LABELS: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

export const GRADE_ORDER = ["G7", "G8", "G9", "G10", "G11", "G12"] as const;

export function gradeLabel(gradeLevel: string): string {
  return GRADE_LABELS[gradeLevel] ?? gradeLevel;
}

export function gradeToNumber(gradeLevel: GradeLevel | string): number {
  const m = String(gradeLevel).match(/\d+/);
  return m ? Number(m[0]) : 0;
}
