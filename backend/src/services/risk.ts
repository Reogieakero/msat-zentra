import { prisma } from "../lib/prisma.js";
import type { RiskLevel } from "@prisma/client";

export interface RiskResult {
  riskCount: number;
  riskLevel: RiskLevel;
}

// PLAN.md §6.3 — live recompute. Returns flags + level without writing.
export async function evaluateRisk(
  studentId: string,
  termId: string
): Promise<{ academicFlag: boolean; attendanceFlag: boolean; behavioralFlag: boolean; result: RiskResult }> {
  const [finalGrades, attendance, anecdotals] = await Promise.all([
    prisma.finalGrade.findMany({ where: { studentId, termId }, select: { transmutedGrade: true } }),
    prisma.attendanceRecord.findMany({ where: { studentId, termId }, select: { status: true } }),
    prisma.anecdotalRecord.count({ where: { studentId, termId } }),
  ]);

  const academicFlag = finalGrades.length > 0
    ? finalGrades.reduce((s, g) => s + (g.transmutedGrade ?? 0), 0) / finalGrades.length < 75
    : false;

  const attTotal = attendance.length;
  const attPresent = attendance.filter((a) => a.status === "present").length;
  const attendanceFlag = attTotal > 0 ? attPresent / attTotal < 0.8 : false;

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

export interface FactorInputs {
  finalGrades: { transmutedGrade: number | null }[];
  attendance: { status: string }[];
  anecdotalCount: number;
}

// Pure recompute of risk flags + level from already-fetched data. Mirrors the
// DB-backed evaluateRisk() rule so every endpoint agrees on a single source of
// truth (>=2 = High, 1 = Moderate, 0 = Low). Used by overview/academics so the
// stored, possibly-stale riskLevel column is never trusted directly.
export function computeRiskFactors(inputs: FactorInputs): RiskFactors {
  const { finalGrades, attendance, anecdotalCount } = inputs;
  const academicFlag =
    finalGrades.length > 0
      ? finalGrades.reduce((s, g) => s + (g.transmutedGrade ?? 0), 0) /
          finalGrades.length <
        75
      : false;
  const attTotal = attendance.length;
  const attPresent = attendance.filter((a) => a.status === "present").length;
  const attendanceFlag = attTotal > 0 ? attPresent / attTotal < 0.8 : false;
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
  return result;
}
