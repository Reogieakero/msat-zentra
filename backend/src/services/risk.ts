import { prisma } from "../lib/prisma.js";
import { resolveActiveTermId as resolveActiveTermIdCore } from "../lib/term-resolve.js";
import { sectionHeadcounts } from "./enrollment.js";
import { notifyInterventionDetected } from "../lib/notify.js";
import type { RiskLevel } from "../generated/prisma/client.js";

export const resolveActiveTermId = resolveActiveTermIdCore;

export interface RiskResult {
  riskCount: number;
  riskLevel: RiskLevel;
}

function flagsFromParts(args: {
  grades: RiskGrade[];
  mode?: GradeMode;
  attendance: { status: string; subjectId: string | null }[];
  anecdotalCount: number;
  enrolled: number;
}): { academicFlag: boolean; attendanceFlag: boolean; behavioralFlag: boolean; result: RiskResult } {
  // Real-time unified rule: EITHER average < 75 flags academic.
  // gradeMode is ignored (kept for backwards compat).
  const finalAvg =
    args.grades.length > 0
      ? args.grades.reduce((s, g) => s + (g.transmutedGrade ?? 0), 0) / args.grades.length
      : null;
  const rawAvg =
    args.grades.length > 0
      ? args.grades.reduce((s, g) => s + (g.computedAverage ?? 0), 0) / args.grades.length
      : null;
  const academicFlag =
    (finalAvg != null && finalAvg < 75) || (rawAvg != null && rawAvg < 75);

  const attPresent = args.attendance.filter((a) => a.status === "present").length;
  const attendanceFlag = args.attendance.some((a) => a.subjectId !== null)
    ? args.attendance.length > 0
      ? attPresent / args.attendance.length < 0.8
      : false
    : args.enrolled > 0
      ? attPresent / args.enrolled < 0.8
      : false;

  const behavioralFlag = args.anecdotalCount >= 1;

  const riskCount = (academicFlag ? 1 : 0) + (attendanceFlag ? 1 : 0) + (behavioralFlag ? 1 : 0);
  const riskLevel: RiskLevel = riskCount >= 2 ? "High" : riskCount === 1 ? "Moderate" : "Low";

  return { academicFlag, attendanceFlag, behavioralFlag, result: { riskCount, riskLevel } };
}

export async function evaluateRisk(
  studentId: string,
  termId: string,
  _gradeMode?: GradeMode,
): Promise<{ academicFlag: boolean; attendanceFlag: boolean; behavioralFlag: boolean; result: RiskResult }> {
  const [finalGrades, attendance, anecdotals, profile] = await Promise.all([
    prisma.finalGrade.findMany({
      where: { studentId, termId },
      select: { computedAverage: true, transmutedGrade: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { studentId, termId },
      select: { status: true, subjectId: true },
    }),
    prisma.anecdotalRecord.count({ where: { studentId, termId } }),
    prisma.studentProfile.findUnique({
      where: { userId: studentId },
      select: { section: { select: { _count: { select: { students: true } } } } },
    }),
  ]);

  return flagsFromParts({
    grades: finalGrades,
    attendance,
    anecdotalCount: anecdotals,
    enrolled: profile?.section?._count.students ?? 0,
  });
}

export interface DualRisk {
  raw: RiskResult;
  final: RiskResult;
  rawFlags: { academicFlag: boolean; attendanceFlag: boolean; behavioralFlag: boolean };
  finalFlags: { academicFlag: boolean; attendanceFlag: boolean; behavioralFlag: boolean };
}

export async function evaluateBothRisk(
  studentId: string,
  termId: string,
): Promise<DualRisk> {
  const [finalGrades, attendance, anecdotals, profile] = await Promise.all([
    prisma.finalGrade.findMany({
      where: { studentId, termId },
      select: { computedAverage: true, transmutedGrade: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { studentId, termId },
      select: { status: true, subjectId: true },
    }),
    prisma.anecdotalRecord.count({ where: { studentId, termId } }),
    prisma.studentProfile.findUnique({
      where: { userId: studentId },
      select: { section: { select: { _count: { select: { students: true } } } } },
    }),
  ]);
  const parts = {
    grades: finalGrades,
    attendance,
    anecdotalCount: anecdotals,
    enrolled: profile?.section?._count.students ?? 0,
  };
  const rawFull = flagsFromParts({ ...parts });
  const finalFull = flagsFromParts({ ...parts });
  return {
    raw: rawFull.result,
    final: finalFull.result,
    rawFlags: {
      academicFlag: rawFull.academicFlag,
      attendanceFlag: rawFull.attendanceFlag,
      behavioralFlag: rawFull.behavioralFlag,
    },
    finalFlags: {
      academicFlag: finalFull.academicFlag,
      attendanceFlag: finalFull.attendanceFlag,
      behavioralFlag: finalFull.behavioralFlag,
    },
  };
}

export interface RiskFactors {
  academicFlag: boolean;
  attendanceFlag: boolean;
  behavioralFlag: boolean;
}

// Deprecated: gradeMode is ignored — all views are real-time unified.
// Kept for backwards compat with callers that still pass it.
export type GradeMode = "raw" | "final";

export interface RiskGrade {
  computedAverage: number | null;
  transmutedGrade: number | null;
}

export interface FactorInputs {
  finalGrades: RiskGrade[];

  rawAverages?: number[];

  gradeMode?: GradeMode;

  attendance: { status: string; subjectId?: string | null }[];
  anecdotalCount: number;

  enrolled: number;
}

export function computeRiskFactors(inputs: FactorInputs): RiskFactors {
  const { finalGrades, rawAverages = [], attendance, anecdotalCount, enrolled } = inputs;
  // Unified real-time rule: EITHER average < 75.
  const finalAvgFromGrades =
    finalGrades.length > 0
      ? finalGrades.reduce((s, g) => s + (g.transmutedGrade ?? 0), 0) / finalGrades.length
      : null;
  const rawAvgFromGrades =
    finalGrades.length > 0
      ? finalGrades.reduce((s, g) => s + (g.computedAverage ?? 0), 0) / finalGrades.length
      : null;
  const rawAvg =
    rawAverages.length > 0
      ? rawAverages.reduce((s, v) => s + v, 0) / rawAverages.length
      : rawAvgFromGrades;
  const academicFlag =
    (finalAvgFromGrades != null && finalAvgFromGrades < 75) ||
    (rawAvg != null && rawAvg < 75);
  const attPresent = attendance.filter((a) => a.status === "present").length;

  const attendanceFlag = attendance.some((a) => a.subjectId != null)
    ? attendance.length > 0
      ? attPresent / attendance.length < 0.8
      : false
    : enrolled > 0
      ? attPresent / enrolled < 0.8
      : false;
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

export async function evaluateRosterRisk(
  rosterId: string,
  termId: string,
  _gradeMode?: GradeMode,
): Promise<{ academicFlag: boolean; attendanceFlag: boolean; behavioralFlag: boolean; result: RiskResult }> {
  const [finalGrades, attendance, anecdotals, roster] = await Promise.all([
    prisma.finalGrade.findMany({
      where: { rosterId, termId },
      select: { computedAverage: true, transmutedGrade: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { rosterId, termId },
      select: { status: true, subjectId: true },
    }),
    prisma.anecdotalRecord.count({ where: { rosterId, termId } }),
    prisma.studentRoster.findUnique({
      where: { id: rosterId },
      select: { sectionId: true },
    }),
  ]);

  const enrolled = roster
    ? ((await sectionHeadcounts([roster.sectionId])).get(roster.sectionId) ?? 0)
    : 0;

  return flagsFromParts({
    grades: finalGrades,
    attendance,
    anecdotalCount: anecdotals,
    enrolled,
  });
}

export async function evaluateBothRosterRisk(
  rosterId: string,
  termId: string,
): Promise<DualRisk> {
  const [finalGrades, attendance, anecdotals, roster] = await Promise.all([
    prisma.finalGrade.findMany({
      where: { rosterId, termId },
      select: { computedAverage: true, transmutedGrade: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { rosterId, termId },
      select: { status: true, subjectId: true },
    }),
    prisma.anecdotalRecord.count({ where: { rosterId, termId } }),
    prisma.studentRoster.findUnique({
      where: { id: rosterId },
      select: { sectionId: true },
    }),
  ]);
  const enrolled = roster
    ? ((await sectionHeadcounts([roster.sectionId])).get(roster.sectionId) ?? 0)
    : 0;
  const parts = { grades: finalGrades, attendance, anecdotalCount: anecdotals, enrolled };
  const rawFull = flagsFromParts({ ...parts });
  const finalFull = flagsFromParts({ ...parts });
  return {
    raw: rawFull.result,
    final: finalFull.result,
    rawFlags: {
      academicFlag: rawFull.academicFlag,
      attendanceFlag: rawFull.attendanceFlag,
      behavioralFlag: rawFull.behavioralFlag,
    },
    finalFlags: {
      academicFlag: finalFull.academicFlag,
      attendanceFlag: finalFull.attendanceFlag,
      behavioralFlag: finalFull.behavioralFlag,
    },
  };
}

export async function recomputeRisk(studentId: string, termId: string) {
  const dual = await evaluateBothRisk(studentId, termId);
  const result = dual.final;
  await prisma.$transaction([
    prisma.studentProfile.update({
      where: { userId: studentId },
      data: {
        riskCount: result.riskCount,
        riskLevel: result.riskLevel,
        academicFlag: dual.finalFlags.academicFlag,
        attendanceFlag: dual.finalFlags.attendanceFlag,
        behavioralFlag: dual.finalFlags.behavioralFlag,
      },
    }),
    prisma.riskSnapshot.create({
      data: {
        studentId,
        riskLevel: result.riskLevel,
        riskLevelRaw: dual.raw.riskLevel,
        riskLevelFinal: result.riskLevel,
        academicFlag: dual.finalFlags.academicFlag,
        attendanceFlag: dual.finalFlags.attendanceFlag,
        behavioralFlag: dual.finalFlags.behavioralFlag,
        academicFlagRaw: dual.rawFlags.academicFlag,
        attendanceFlagRaw: dual.rawFlags.attendanceFlag,
        behavioralFlagRaw: dual.rawFlags.behavioralFlag,
        riskCount: result.riskCount,
        termId,
      },
    }),
  ]);

  const atRisk = result.riskLevel === "High" || result.riskLevel === "Moderate";
  if (atRisk) {
    const open = await prisma.intervention.findFirst({
      where: { studentId, termId, outcomeStatus: { not: "resolved" }, approvalStatus: { not: "rejected" } },
      select: { id: true },
    });
    if (!open) {
      const guidance = await prisma.user.findFirst({
        where: { role: "guidance_counselor", status: "active" },
        select: { id: true },
      });
      if (guidance) {
        const created = await prisma.intervention.create({
          data: {
            studentId,
            termId,
            riskLevelAtFlag: result.riskLevel,
            recommendedAction: "Auto-flagged at-risk student — assigned to Guidance Counselor for follow-up.",
            assignedTo: guidance.id,
            assignedAt: new Date(),
            approvalStatus: "approved",
            outcomeStatus: "ongoing",
          },
        });

        void notifyInterventionDetected({
          level: result.riskLevel,
          interventionId: created.id,
          studentId,
        });
      }
    }
  }
  return result;
}

export async function recomputeRosterRisk(rosterId: string, termId: string) {
  const dual = await evaluateBothRosterRisk(rosterId, termId);
  const result = dual.final;
  await prisma.$transaction([
    prisma.studentRoster.update({
      where: { id: rosterId },
      data: {
        riskCount: result.riskCount,
        riskLevel: result.riskLevel,
        academicFlag: dual.finalFlags.academicFlag,
        attendanceFlag: dual.finalFlags.attendanceFlag,
        behavioralFlag: dual.finalFlags.behavioralFlag,
      },
    }),
    prisma.riskSnapshot.create({
      data: {
        studentId: null,
        rosterId,
        riskLevel: result.riskLevel,
        riskLevelRaw: dual.raw.riskLevel,
        riskLevelFinal: result.riskLevel,
        academicFlag: dual.finalFlags.academicFlag,
        attendanceFlag: dual.finalFlags.attendanceFlag,
        behavioralFlag: dual.finalFlags.behavioralFlag,
        academicFlagRaw: dual.rawFlags.academicFlag,
        attendanceFlagRaw: dual.rawFlags.attendanceFlag,
        behavioralFlagRaw: dual.rawFlags.behavioralFlag,
        riskCount: result.riskCount,
        termId,
      },
    }),
  ]);

  const atRisk = result.riskLevel === "High" || result.riskLevel === "Moderate";
  if (atRisk) {
    const open = await prisma.intervention.findFirst({
      where: { rosterId, termId, outcomeStatus: { not: "resolved" }, approvalStatus: { not: "rejected" } },
      select: { id: true },
    });
    if (!open) {
      const guidance = await prisma.user.findFirst({
        where: { role: "guidance_counselor", status: "active" },
        select: { id: true },
      });
      if (guidance) {
        const created = await prisma.intervention.create({
          data: {
            studentId: null,
            rosterId,
            termId,
            riskLevelAtFlag: result.riskLevel,
            recommendedAction: "Auto-flagged at-risk student — assigned to Guidance Counselor for follow-up.",
            assignedTo: guidance.id,
            assignedAt: new Date(),
            approvalStatus: "approved",
            outcomeStatus: "ongoing",
          },
        });

        void notifyInterventionDetected({
          level: result.riskLevel,
          interventionId: created.id,
          rosterId,
        });
      }
    }
  }
  return result;
}
