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

/**
 * Upload scope check: in-band grades always pass; an empty band (principal
 * and other non-band roles) passes everything. The registrar additionally
 * takes in JHS completers — a record topping out at G10 may be uploaded by
 * the registrar even though G10 sits in the record-keeper band.
 */
export function canUploadGradeLevel(role: string, band: string[], gradeLevel: string): boolean {
  if (band.length === 0 || band.includes(gradeLevel)) return true;
  return role === "registrar" && gradeLevel === "G10";
}

/**
 * Grade to file a newly provisioned student under. A registrar upload of a
 * JHS-completer file (tops out at G10) creates an incoming SHS learner
 * (G11), so the record lands in the registrar's scope instead of living
 * invisibly in the record-keeper's table. Also applied when a registrar
 * re-upload links to an existing G10 student by LRN.
 */
export function provisionGradeForUpload(role: string, readGrade: string): string {
  return role === "registrar" && readGrade === "G10" ? "G11" : readGrade;
}

export type Sf10Desk = "registrar" | "record_keeper";

/** Owning desk for a role; null when the role has no desk (principal, adviser, …). */
export function deskForRole(role: string): Sf10Desk | null {
  if (role === "registrar") return "registrar";
  if (role === "record_keeper") return "record_keeper";
  return null;
}

/**
 * Desk a new upload is filed under: the uploader's own desk, or — for roles
 * without a desk (adviser, …) — derived from the student's grade so prior
 * visibility is preserved.
 */
export function deskForUpload(role: string, studentGrade: string): Sf10Desk {
  const desk = deskForRole(role);
  if (desk) return desk;
  return studentGrade === "G11" || studentGrade === "G12" ? "registrar" : "record_keeper";
}
