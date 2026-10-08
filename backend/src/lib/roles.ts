import type { GradeLevel, Role } from "../generated/prisma/client.js";

export type GradeBand = "7-10" | "11-12";

export const GRADE_BAND_7_10: GradeLevel[] = ["G7", "G8", "G9", "G10"];
export const GRADE_BAND_11_12: GradeLevel[] = ["G11", "G12"];

export const SELF_ROLES: Role[] = ["student", "parent", "subject_teacher", "adviser"];

export const STAFF_ROLES: Role[] = [
  "subject_teacher",
  "adviser",
  "nurse",
  "adm_coordinator",
  "guidance_counselor",
  "record_keeper",
  "registrar",
  "principal",
];

export const KNOWN_ROLES: Role[] = [...STAFF_ROLES, "student", "parent"];

export const TEACHER_ROLES: Role[] = ["subject_teacher", "adviser"];

export function bandForGrade(grade: GradeLevel): GradeBand {
  return GRADE_BAND_7_10.includes(grade) ? "7-10" : "11-12";
}

export function roleGradeBand(role?: string): GradeLevel[] {
  return role === "record_keeper" ? GRADE_BAND_7_10 : GRADE_BAND_11_12;
}

export function gradeBandForRole(role: string): GradeBand | null {
  if (role === "record_keeper") return "7-10";
  if (role === "registrar") return "11-12";
  return null;
}

export function isBandRole(role?: string): boolean {
  return role === "record_keeper" || role === "registrar";
}

export function bandAllowed(role: string, band: GradeBand): boolean {
  return (
    (role === "record_keeper" && band === "7-10") ||
    (role === "registrar" && band === "11-12")
  );
}
