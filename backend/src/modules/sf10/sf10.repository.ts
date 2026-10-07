import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";

// Shared SF10 data-access: grade-band policy and the grade-scoped record
// gate. Endpoint orchestration lives in src/services/sf10/sf10.service.ts.

// Registrar = senior high (11–12), Record Keeper = junior high (7–10). These
// bands are fixed by PLAN.md §4.1 and must apply even when a staffProfile row
// is missing (e.g. seeded registrar has no handledGradeLevels). Advisers/teachers
// fall back to their staffProfile.handledGradeLevels when present.
export const ROLE_GRADE_BAND: Record<string, string[]> = {
  registrar: ["G11", "G12"],
  record_keeper: ["G7", "G8", "G9", "G10"],
};

export async function resolveGradeBand(role: string, userId: string): Promise<string[]> {
  if (ROLE_GRADE_BAND[role]) return ROLE_GRADE_BAND[role];
  const staff = await prisma.staffProfile.findUnique({
    where: { userId },
    select: { handledGradeLevels: true },
  });
  return staff?.handledGradeLevels ?? [];
}

export const GRADE_ORDER = ["G7", "G8", "G9", "G10", "G11", "G12"] as const;
export const GRADE_LABEL: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

export async function assertHandlesGrade(recordId: string, user: { userId: string; role: string }) {
  const record = await prisma.sf10Record.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      status: true,
      verifiedBy: true,
      currentVersion: true,
      ocrExtractedData: true,
      student: { select: { gradeLevel: true } },
    },
  });
  if (!record) throw new AppError(404, "NOT_FOUND", "SF10 record not found");
  const band = await resolveGradeBand(user.role, user.userId);
  if (band.length > 0 && !band.includes(record.student.gradeLevel)) {
    throw new AppError(403, "GRADE_SCOPE", "You do not handle this student's grade level");
  }
  return record;
}
