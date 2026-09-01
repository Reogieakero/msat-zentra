import { prisma } from "../lib/prisma.js";
import type { RiskLevel } from "../generated/prisma/client.js";

// Single source of truth for "the active term": the first term (by termNumber
// asc) of the active school year. Used by every risk endpoint/service so the
// live recompute never drifts between the board, heatmap, and students list.
export async function resolveActiveTermId(): Promise<string | null> {
  const term = await prisma.term.findFirst({
    where: { schoolYear: { isActive: true } },
    orderBy: { termNumber: "asc" },
    select: { id: true },
  });
  return term?.id ?? null;
}

export interface RiskResult {
  riskCount: number;
  riskLevel: RiskLevel;
}

// PLAN.md §6.3 — live recompute. Returns flags + level without writing.
export async function evaluateRisk(
  studentId: string,
  termId: string,
  gradeMode: GradeMode = "final"
): Promise<{ academicFlag: boolean; attendanceFlag: boolean; behavioralFlag: boolean; result: RiskResult }> {
  const [finalGrades, attendance, anecdotals, profile] = await Promise.all([
    prisma.finalGrade.findMany({
      where: { studentId, termId },
      select: { computedAverage: true, transmutedGrade: true },
    }),
    prisma.attendanceRecord.findMany({ where: { studentId, termId }, select: { status: true } }),
    prisma.anecdotalRecord.count({ where: { studentId, termId } }),
    prisma.studentProfile.findUnique({
      where: { userId: studentId },
      select: { section: { select: { _count: { select: { students: true } } } } },
    }),
  ]);

  const academicFlag = finalGrades.length > 0
    ? finalGrades.reduce((s, g) => s + (gradeValue(g, gradeMode) ?? 0), 0) / finalGrades.length < 75
    : false;

  const attPresent = attendance.filter((a) => a.status === "present").length;
  const enrolled = profile?.section?._count.students ?? 0;
  const attendanceFlag = enrolled > 0 ? attPresent / enrolled < 0.8 : false;

  const behavioralFlag = anecdotals >= 1;

  const riskCount = (academicFlag ? 1 : 0) + (attendanceFlag ? 1 : 0) + (behavioralFlag ? 1 : 0);
  const riskLevel: RiskLevel = riskCount >= 2 ? "High" : riskCount === 1 ? "Moderate" : "Low";

  return { academicFlag, attendanceFlag, behavioralFlag, result: { riskCount, riskLevel } };
}

export interface RiskFactors {
  academicFlag: boolean;
  attendanceFlag: boolean;
  behavioralFlag: boolean;
}

export type GradeMode = "raw" | "final";

// A subject grade with both the raw (pre-transmutation) average and the final
// transmuted grade, so the academic flag can be recomputed on either basis.
export interface RiskGrade {
  computedAverage: number | null;
  transmutedGrade: number | null;
}

export interface FactorInputs {
  finalGrades: RiskGrade[];
  // "final" = recompute academic risk from each subject's transmutedGrade
  // (DepEd transmuted). "raw" = recompute from each subject's computedAverage
  // (the raw weighted component average, before transmutation).
  gradeMode?: GradeMode;
  attendance: { status: string }[];
  anecdotalCount: number;
  // Enrolled headcount of the student's section. The attendance flag uses
  // present / enrolled (consistent with the Attendance heatmap/system), not
  // present / submittedRecords.
  enrolled: number;
}

// Picks the grade value used for the academic flag given the selected basis.
function gradeValue(g: RiskGrade, mode: GradeMode): number | null {
  return mode === "raw" ? g.computedAverage : g.transmutedGrade;
}

// Pure recompute of risk flags + level from already-fetched data. Mirrors the
// DB-backed evaluateRisk() rule so every endpoint agrees on a single source of
// truth (>=2 = High, 1 = Moderate, 0 = Low). Used by overview/academics so the
// stored, possibly-stale riskLevel column is never trusted directly.
export function computeRiskFactors(inputs: FactorInputs): RiskFactors {
  const { finalGrades, gradeMode = "final", attendance, anecdotalCount, enrolled } = inputs;
  const academicFlag =
    finalGrades.length > 0
      ? finalGrades.reduce((s, g) => s + (gradeValue(g, gradeMode) ?? 0), 0) /
          finalGrades.length <
        75
      : false;
  const attPresent = attendance.filter((a) => a.status === "present").length;
  // present / enrolled < 0.8 → at-risk. A student with zero recorded presence
  // (enrolled > 0, present = 0) is below 80% and is flagged.
  const attendanceFlag = enrolled > 0 ? attPresent / enrolled < 0.8 : false;
  const behavioralFlag = anecdotalCount >= 1;
  return { academicFlag, attendanceFlag, behavioralFlag };
}

export function levelFromFlags(flags: RiskFactors): RiskLevel {
  const riskCount =
    (flags.academicFlag ? 1 : 0) +
    (flags.attendanceFlag ? 1 : 0) +
    (flags.behavioralFlag ? 1 : 0);
  return riskCount >= 2 ? "High" : riskCount === 1 ? "Moderate" : "Low";
}

export function isAtRisk(level: RiskLevel): boolean {
  return level === "High" || level === "Moderate";
}

// Writes the computed risk to student_profiles and appends a risk_snapshots row (O4).
// When a student crosses into Moderate/High risk and has no open intervention, an
// intervention is auto-created and assigned to the Guidance Counselor — interventions
// are engine-driven, not manually assigned by the Principal (who only views/tracks).
export async function recomputeRisk(studentId: string, termId: string) {
  const { result } = await evaluateRisk(studentId, termId);
  await prisma.$transaction([
    prisma.studentProfile.update({
      where: { userId: studentId },
      data: { riskCount: result.riskCount, riskLevel: result.riskLevel },
    }),
    prisma.riskSnapshot.create({
      data: { studentId, riskLevel: result.riskLevel, riskCount: result.riskCount, termId },
    }),
  ]);

  const atRisk = result.riskLevel === "High" || result.riskLevel === "Moderate";
  if (atRisk) {
    const open = await prisma.intervention.findFirst({
      where: { studentId, outcomeStatus: { not: "resolved" }, approvalStatus: { not: "rejected" } },
      select: { id: true },
    });
    if (!open) {
      const guidance = await prisma.user.findFirst({
        where: { role: "guidance_counselor", status: "active" },
        select: { id: true },
      });
      if (guidance) {
        await prisma.intervention.create({
          data: {
            studentId,
            riskLevelAtFlag: result.riskLevel,
            recommendedAction: "Auto-flagged at-risk student — assigned to Guidance Counselor for follow-up.",
            assignedTo: guidance.id,
            assignedAt: new Date(),
            approvalStatus: "approved",
            outcomeStatus: "ongoing",
          },
        });
      }
    }
  }
  return result;
}
