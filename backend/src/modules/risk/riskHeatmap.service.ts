import { prisma } from "../../lib/prisma.js";
import type { RiskLevel } from "../../generated/prisma/client.js";
import { computeRiskFactors, levelFromFlags, type GradeMode } from "../../services/risk.js";
import { sectionHeadcounts } from "../../services/enrollment.js";

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

// Real-time unified: gradeMode is ignored (kept for backwards compat).
// Always computes live from FinalGrade/Attendance/Anecdotal for the active term
// using the same EITHER-avg<75 rule as getRiskStudents.
export async function getRiskHeatmap(
  termId: string,
  _gradeMode?: GradeMode,
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

  const [allProfiles, allRoster] = await Promise.all([
    sectionIds.length
      ? prisma.studentProfile.findMany({
          where: { sectionId: { in: sectionIds } },
          take: 5000,
          select: {
            lrn: true,
            sectionId: true,
            finalGrades: {
              where: { termId },
              select: { computedAverage: true, transmutedGrade: true },
            },
            attendanceRecords: { where: { termId }, select: { status: true, subjectId: true } },
            anecdotalRecords: { where: { termId }, select: { id: true } },
          },
        })
      : Promise.resolve([]),
    sectionIds.length
      ? prisma.studentRoster.findMany({
          where: { sectionId: { in: sectionIds } },
          take: 5000,
          select: {
            lrn: true,
            sectionId: true,
            finalGrades: {
              where: { termId },
              select: { computedAverage: true, transmutedGrade: true },
            },
            attendanceRecords: { where: { termId }, select: { status: true, subjectId: true } },
            anecdotalRecords: { where: { termId }, select: { id: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const headcounts = await sectionHeadcounts(sectionIds);

  type BulkRow = {
    lrn: string;
    sectionId: string | null;
    finalGrades: { computedAverage: number | null; transmutedGrade: number | null }[];
    attendanceRecords: { status: string; subjectId: string | null }[];
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
    const enrolled = headcounts.get(sec.id) ?? bucket.profiles.length + rosterOnly.length;
    let academic = 0;
    let attendance = 0;
    let behavioral = 0;
    for (const s of [...bucket.profiles, ...rosterOnly]) {
      const flags = computeRiskFactors({
        finalGrades: s.finalGrades,
        attendance: s.attendanceRecords,
        anecdotalCount: s.anecdotalRecords.length,
        enrolled,
      });
      if (flags.academicFlag) academic++;
      if (flags.attendanceFlag) attendance++;
      if (flags.behavioralFlag) behavioral++;
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
  _gradeMode?: GradeMode,
): Promise<HeatmapStudent[]> {
  const { sectionHeadcounts } = await import("../../services/enrollment.js");
  const [students, rosterEntries] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId },
      select: {
        lrn: true,
        user: { select: { fullName: true } },
        finalGrades: {
          where: { termId },
          select: { computedAverage: true, transmutedGrade: true },
        },
        attendanceRecords: { where: { termId }, select: { status: true, subjectId: true } },
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
        attendanceRecords: { where: { termId }, select: { status: true, subjectId: true } },
        anecdotalRecords: { where: { termId }, select: { id: true } },
      },
    }),
  ]);
  const registeredLrns = new Set(students.map((s) => s.lrn));
  const headcounts = await sectionHeadcounts([sectionId]);
  const enrolled = headcounts.get(sectionId) ?? students.length + rosterEntries.length;

  type FactorStudent = {
    lrn: string;
    name: string;
    riskLevel: RiskLevel;
    flags: { academicFlag: boolean; attendanceFlag: boolean; behavioralFlag: boolean };
  };

  const cohort: FactorStudent[] = [
    ...students.map((s) => {
      const flags = computeRiskFactors({
        finalGrades: s.finalGrades,
        attendance: s.attendanceRecords,
        anecdotalCount: s.anecdotalRecords.length,
        enrolled,
      });
      return {
        lrn: s.lrn,
        name: s.user.fullName,
        riskLevel: levelFromFlags(flags),
        flags,
      };
    }),
    ...rosterEntries
      .filter((r) => !registeredLrns.has(r.lrn))
      .map((r) => {
        const flags = computeRiskFactors({
          finalGrades: r.finalGrades,
          attendance: r.attendanceRecords,
          anecdotalCount: r.anecdotalRecords.length,
          enrolled,
        });
        return {
          lrn: r.lrn,
          name: r.fullName,
          riskLevel: levelFromFlags(flags),
          flags,
        };
      }),
  ];

  const matches = (s: FactorStudent): boolean => {
    if (factor === "Academic") return s.flags.academicFlag;
    if (factor === "Attendance") return s.flags.attendanceFlag;
    return s.flags.behavioralFlag;
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
