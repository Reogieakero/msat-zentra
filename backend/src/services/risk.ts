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

  const academicFlag = finalGrades.length > 0
    ? finalGrades.reduce((s, g) => s + (gradeValue(g, gradeMode) ?? 0), 0) / finalGrades.length < 75
    : false;

  const attPresent = attendance.filter((a) => a.status === "present").length;
  const enrolled = profile?.section?._count.students ?? 0;

  const attendanceFlag = attendance.some((a) => a.subjectId !== null)
    ? attendance.length > 0
      ? attPresent / attendance.length < 0.8
      : false
    : enrolled > 0
      ? attPresent / enrolled < 0.8
      : false;

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

function gradeValue(g: RiskGrade, mode: GradeMode): number | null {
  return mode === "raw" ? g.computedAverage : g.transmutedGrade;
}

export function computeRiskFactors(inputs: FactorInputs): RiskFactors {
  const { finalGrades, rawAverages = [], gradeMode = "final", attendance, anecdotalCount, enrolled } = inputs;
  const finalAvg =
    finalGrades.length > 0
      ? finalGrades.reduce((s, g) => s + (gradeValue(g, gradeMode) ?? 0), 0) /
        finalGrades.length
      : null;
  const rawAvg =
    rawAverages.length > 0
      ? rawAverages.reduce((s, v) => s + v, 0) / rawAverages.length
      : null;
  const academicFlag =
    (finalAvg != null && finalAvg < 75) || (rawAvg != null && rawAvg < 75);
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
  gradeMode: GradeMode = "final"
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

  const academicFlag = finalGrades.length > 0
    ? finalGrades.reduce((s, g) => s + (gradeValue(g, gradeMode) ?? 0), 0) / finalGrades.length < 75
    : false;

  const attPresent = attendance.filter((a) => a.status === "present").length;
  const attendanceFlag = attendance.some((a) => a.subjectId !== null)
    ? attendance.length > 0
      ? attPresent / attendance.length < 0.8
      : false
    : enrolled > 0
      ? attPresent / enrolled < 0.8
      : false;

  const behavioralFlag = anecdotals >= 1;

  const riskCount = (academicFlag ? 1 : 0) + (attendanceFlag ? 1 : 0) + (behavioralFlag ? 1 : 0);
  const riskLevel: RiskLevel = riskCount >= 2 ? "High" : riskCount === 1 ? "Moderate" : "Low";

  return { academicFlag, attendanceFlag, behavioralFlag, result: { riskCount, riskLevel } };
}

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
  const { result } = await evaluateRosterRisk(rosterId, termId);
  await prisma.riskSnapshot.create({
    data: { studentId: null, rosterId, riskLevel: result.riskLevel, riskCount: result.riskCount, termId },
  });

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
