import { prisma } from "../../lib/prisma.js";
import type { RiskLevel } from "../../generated/prisma/client.js";
import type { GradeMode } from "../../services/risk.js";

export type RiskFactor = "Academic" | "Attendance" | "Behavioral";

export interface HeatmapSection {
  sectionId: string;
  section: string;
  gradeLevel: string;
  factors: Record<RiskFactor, number>;
}

export interface HeatmapResult {
  termId: string;
  sections: HeatmapSection[];
  factorTotals: Record<RiskFactor, number>;
}

async function sectionFactors(
  sectionId: string,
  termId: string,
  gradeMode: GradeMode = "final"
): Promise<Record<RiskFactor, number>> {
  const students = await prisma.studentProfile.findMany({
    where: { sectionId },
    select: {
      userId: true,
      finalGrades: {
        where: { termId },
        select: { computedAverage: true, transmutedGrade: true },
      },
      attendanceRecords: { where: { termId }, select: { status: true } },
      anecdotalRecords: { where: { termId }, select: { id: true } },
    },
  });

  // Enrolled headcount = every student in the section (matches the Attendance
  // system's enrolledBySection denominator).
  const enrolled = students.length;

  let academic = 0;
  let attendance = 0;
  let behavioral = 0;

  const gradeOf = (g: { computedAverage: number | null; transmutedGrade: number | null }) =>
    gradeMode === "raw" ? g.computedAverage : g.transmutedGrade;

  for (const s of students) {
    const avg =
      s.finalGrades.length > 0
        ? s.finalGrades.reduce((sum, g) => sum + (gradeOf(g) ?? 0), 0) /
          s.finalGrades.length
        : 100;
    if (avg < 75) academic++;

    const present = s.attendanceRecords.filter((a) => a.status === "present").length;
    if (enrolled > 0 && present / enrolled < 0.8) attendance++;

    if (s.anecdotalRecords.length > 0) behavioral++;
  }

  return { Academic: academic, Attendance: attendance, Behavioral: behavioral };
}

// All sections × risk-factor counts for the active board (O4, status-only).
export async function getRiskHeatmap(
  termId: string,
  gradeMode: GradeMode = "final"
): Promise<HeatmapResult> {
  const sections = await prisma.section.findMany({
    where: { schoolYear: { isActive: true } },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
    select: { id: true, name: true, gradeLevel: true },
  });

  const factorTotals: Record<RiskFactor, number> = {
    Academic: 0,
    Attendance: 0,
    Behavioral: 0,
  };

  const result: HeatmapSection[] = [];
  for (const sec of sections) {
    const factors = await sectionFactors(sec.id, termId, gradeMode);
    factorTotals.Academic += factors.Academic;
    factorTotals.Attendance += factors.Attendance;
    factorTotals.Behavioral += factors.Behavioral;
    result.push({
      sectionId: sec.id,
      section: sec.name,
      gradeLevel: sec.gradeLevel,
      factors,
    });
  }

  return { termId, sections: result, factorTotals };
}

export interface HeatmapStudent {
  lrn: string;
  name: string;
  riskLevel: RiskLevel;
  factor: RiskFactor;
}

// Per-section x factor at-risk student list (principal only).
export async function getSectionFactorStudents(
  sectionId: string,
  factor: RiskFactor,
  termId: string,
  gradeMode: GradeMode = "final"
): Promise<HeatmapStudent[]> {
  const students = await prisma.studentProfile.findMany({
    where: { sectionId },
    select: {
      lrn: true,
      riskLevel: true,
      user: { select: { fullName: true } },
      finalGrades: {
        where: { termId },
        select: { computedAverage: true, transmutedGrade: true },
      },
      attendanceRecords: { where: { termId }, select: { status: true } },
      anecdotalRecords: { where: { termId }, select: { id: true } },
    },
  });

  const gradeOf = (g: { computedAverage: number | null; transmutedGrade: number | null }) =>
    gradeMode === "raw" ? g.computedAverage : g.transmutedGrade;

  const matches = (s: (typeof students)[number]): boolean => {
    const avg =
      s.finalGrades.length > 0
        ? s.finalGrades.reduce((sum, g) => sum + (gradeOf(g) ?? 0), 0) /
          s.finalGrades.length
        : 100;
    const present = s.attendanceRecords.filter((a) => a.status === "present").length;
    const total = s.attendanceRecords.length;
    const attFlag = total > 0 && present / total < 0.8;
    const anecFlag = s.anecdotalRecords.length > 0;

    if (factor === "Academic") return avg < 75;
    if (factor === "Attendance") return attFlag;
    return anecFlag;
  };

  return students
    .filter(matches)
    .map((s) => ({
      lrn: s.lrn,
      name: s.user.fullName,
      riskLevel: s.riskLevel,
      factor,
    }));
}
