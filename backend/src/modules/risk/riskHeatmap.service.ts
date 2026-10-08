import { prisma } from "../../lib/prisma.js";
import type { RiskLevel } from "../../generated/prisma/client.js";
import { computeRiskFactors, levelFromFlags, type GradeMode } from "../../services/risk.js";

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

export async function getRiskHeatmap(
  termId: string,
  gradeMode: GradeMode = "final",
  schoolYearId?: string | null,
): Promise<HeatmapResult> {
  const sections = await prisma.section.findMany({
    where: schoolYearId
      ? { schoolYearId }
      : { schoolYear: { isActive: true } },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
    select: { id: true, name: true, gradeLevel: true },
  });

  const factorTotals: Record<RiskFactor, number> = {
    Academic: 0,
    Attendance: 0,
    Behavioral: 0,
  };

  const sectionIds = sections.map((s) => s.id);
  const gradeOf = (g: { computedAverage: number | null; transmutedGrade: number | null }) =>
    gradeMode === "raw" ? g.computedAverage : g.transmutedGrade;

  const [allProfiles, allRoster] = await Promise.all([
    sectionIds.length
      ? prisma.studentProfile.findMany({
          where: { sectionId: { in: sectionIds } },
          select: {
            lrn: true,
            sectionId: true,
            finalGrades: {
              where: { termId },
              select: { computedAverage: true, transmutedGrade: true },
            },
            attendanceRecords: { where: { termId }, select: { status: true } },
            anecdotalRecords: { where: { termId }, select: { id: true } },
          },
        })
      : Promise.resolve([]),
    sectionIds.length
      ? prisma.studentRoster.findMany({
          where: { sectionId: { in: sectionIds } },
          select: {
            lrn: true,
            sectionId: true,
            finalGrades: {
              where: { termId },
              select: { computedAverage: true, transmutedGrade: true },
            },
            attendanceRecords: { where: { termId }, select: { status: true } },
            anecdotalRecords: { where: { termId }, select: { id: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  type BulkRow = {
    lrn: string;
    sectionId: string | null;
    finalGrades: { computedAverage: number | null; transmutedGrade: number | null }[];
    attendanceRecords: { status: string }[];
    anecdotalRecords: { id: string }[];
  };
  const bySection = new Map<string, { profiles: BulkRow[]; roster: BulkRow[] }>();
  for (const sec of sections) bySection.set(sec.id, { profiles: [], roster: [] });
  for (const p of allProfiles as BulkRow[]) {
    if (p.sectionId) bySection.get(p.sectionId)?.profiles.push(p);
  }
  for (const r of allRoster as BulkRow[]) {
    if (r.sectionId) bySection.get(r.sectionId)?.roster.push(r);
  }

  const result: HeatmapSection[] = sections.map((sec) => {
    const bucket = bySection.get(sec.id) ?? { profiles: [], roster: [] };
    const registeredLrns = new Set(bucket.profiles.map((s) => s.lrn));
    const rosterOnly = bucket.roster.filter((r) => !registeredLrns.has(r.lrn));
    const cohort = [
      ...bucket.profiles.map((s) => ({
        finalGrades: s.finalGrades,
        attendanceRecords: s.attendanceRecords,
        anecdotalCount: s.anecdotalRecords.length,
      })),
      ...rosterOnly.map((r) => ({
        finalGrades: r.finalGrades,
        attendanceRecords: r.attendanceRecords,
        anecdotalCount: r.anecdotalRecords.length,
      })),
    ];
    const enrolled = cohort.length;
    let academic = 0;
    let attendance = 0;
    let behavioral = 0;
    for (const s of cohort) {
      const avg =
        s.finalGrades.length > 0
          ? s.finalGrades.reduce((sum, g) => sum + (gradeOf(g) ?? 0), 0) /
            s.finalGrades.length
          : 100;
      if (avg < 75) academic++;
      const present = s.attendanceRecords.filter((a) => a.status === "present").length;
      if (enrolled > 0 && present / enrolled < 0.8) attendance++;
      if (s.anecdotalCount > 0) behavioral++;
    }
    const factors = { Academic: academic, Attendance: attendance, Behavioral: behavioral };
    factorTotals.Academic += factors.Academic;
    factorTotals.Attendance += factors.Attendance;
    factorTotals.Behavioral += factors.Behavioral;
    return {
      sectionId: sec.id,
      section: sec.name,
      gradeLevel: sec.gradeLevel,
      factors,
    };
  });

  return { termId, sections: result, factorTotals };
}

export interface HeatmapStudent {
  lrn: string;
  name: string;
  riskLevel: RiskLevel;
  factor: RiskFactor;
}

export async function getSectionFactorStudents(
  sectionId: string,
  factor: RiskFactor,
  termId: string,
  gradeMode: GradeMode = "final"
): Promise<HeatmapStudent[]> {
  const [students, rosterEntries] = await Promise.all([
    prisma.studentProfile.findMany({
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
    }),
    prisma.studentRoster.findMany({
      where: { sectionId },
      select: {
        lrn: true,
        fullName: true,
        finalGrades: {
          where: { termId },
          select: { computedAverage: true, transmutedGrade: true },
        },
        attendanceRecords: { where: { termId }, select: { status: true } },
        anecdotalRecords: { where: { termId }, select: { id: true } },
      },
    }),
  ]);
  const registeredLrns = new Set(students.map((s) => s.lrn));

  type FactorStudent = {
    lrn: string;
    name: string;
    riskLevel: RiskLevel;
    finalGrades: { computedAverage: number | null; transmutedGrade: number | null }[];
    attendanceRecords: { status: string }[];
    anecdotalCount: number;
  };
  const gradeOf = (g: { computedAverage: number | null; transmutedGrade: number | null }) =>
    gradeMode === "raw" ? g.computedAverage : g.transmutedGrade;

  const cohort: FactorStudent[] = [
    ...students.map((s) => ({
      lrn: s.lrn,
      name: s.user.fullName,
      riskLevel: s.riskLevel,
      finalGrades: s.finalGrades,
      attendanceRecords: s.attendanceRecords,
      anecdotalCount: s.anecdotalRecords.length,
    })),
    ...rosterEntries
      .filter((r) => !registeredLrns.has(r.lrn))
      .map((r) => {
        const flags = computeRiskFactors({
          finalGrades: r.finalGrades,
          attendance: r.attendanceRecords,
          anecdotalCount: r.anecdotalRecords.length,
          enrolled: 1,
        });
        return {
          lrn: r.lrn,
          name: r.fullName,
          riskLevel: levelFromFlags(flags),
          finalGrades: r.finalGrades,
          attendanceRecords: r.attendanceRecords,
          anecdotalCount: r.anecdotalRecords.length,
        };
      }),
  ];

  const matches = (s: FactorStudent): boolean => {
    const avg =
      s.finalGrades.length > 0
        ? s.finalGrades.reduce((sum, g) => sum + (gradeOf(g) ?? 0), 0) /
          s.finalGrades.length
        : 100;
    const present = s.attendanceRecords.filter((a) => a.status === "present").length;
    const total = s.attendanceRecords.length;
    const attFlag = total > 0 && present / total < 0.8;
    const anecFlag = s.anecdotalCount > 0;

    if (factor === "Academic") return avg < 75;
    if (factor === "Attendance") return attFlag;
    return anecFlag;
  };

  return cohort
    .filter(matches)
    .map((s) => ({
      lrn: s.lrn,
      name: s.name,
      riskLevel: s.riskLevel,
      factor,
    }));
}
