import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { GRADE_BAND_11_12, GRADE_BAND_7_10 } from "../../lib/roles.js";
import { GRADE_LABELS, GRADE_ORDER as ORDER } from "../../lib/grades.js";

export const ROLE_GRADE_BAND: Record<string, string[]> = {
  registrar: [...GRADE_BAND_11_12],
  record_keeper: [...GRADE_BAND_7_10],
};

export async function resolveGradeBand(role: string, userId: string): Promise<string[]> {
  if (ROLE_GRADE_BAND[role]) return ROLE_GRADE_BAND[role];
  const staff = await prisma.staffProfile.findUnique({
    where: { userId },
    select: { handledGradeLevels: true },
  });
  return staff?.handledGradeLevels ?? [];
}

export const GRADE_ORDER = ORDER;
export const GRADE_LABEL = GRADE_LABELS;

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
