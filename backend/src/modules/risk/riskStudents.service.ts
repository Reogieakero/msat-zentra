import { prisma } from "../../lib/prisma.js";
import {
  computeRiskFactors,
  levelFromFlags,
  resolveActiveTermId,
  type GradeMode,
} from "../../services/risk.js";
import { sectionHeadcounts } from "../../services/enrollment.js";
import type { TermScopeInput } from "../../lib/termScope.js";

export type RiskFactor = "Academic" | "Attendance" | "Behavioral";

export interface RiskStudentRow {
  studentId: string;
  lrn: string;
  name: string;
  section: string;
  riskLevel: string;
  riskCount: number;
  factors: Record<RiskFactor, boolean>;
}

export interface RiskStudentsResult {
  students: RiskStudentRow[];
  total: number;
  page: number;
  pageSize: number;
}

const LEVEL_RANK: Record<string, number> = { High: 3, Moderate: 2, Low: 1 };

export interface RiskStudentFilters {
  riskLevel?: "High" | "Moderate" | "Low";
  factor?: RiskFactor;
}

// Real-time unified: gradeMode is ignored (kept for backwards compat).
// Always computes live from FinalGrade/Attendance/Anecdotal for the active term.
export async function getRiskStudents(
  page: number,
  pageSize: number,
  section?: string,
  _gradeMode?: GradeMode,
  scope?: TermScopeInput,
  q?: string,
  extra?: RiskStudentFilters,
): Promise<RiskStudentsResult> {
  const effPageSize = Math.min(Math.max(1, Math.floor(pageSize) || 15), 15);
  return getRiskStudentsLive(page, effPageSize, section, scope, q, extra);
}

async function getRiskStudentsLive(
  page: number,
  pageSize: number,
  section?: string,
  scope?: TermScopeInput,
  q?: string,
  extra?: RiskStudentFilters,
): Promise<RiskStudentsResult> {
  const termId = scope?.termId ?? (await resolveActiveTermId());
  const schoolYearId =
    scope?.schoolYearId ??
    (
      await prisma.schoolYear.findFirst({
        where: { isActive: true },
        select: { id: true },
      })
    )?.id;

  const needle = (q ?? "").trim();
  const profileSearch: any = needle
    ? {
        OR: [
          { user: { fullName: { contains: needle, mode: "insensitive" } } },
          { lrn: { contains: needle, mode: "insensitive" } },
          { section: { name: { contains: needle, mode: "insensitive" } } },
        ],
      }
    : null;
  const rosterSearch: any = needle
    ? {
        OR: [
          { fullName: { contains: needle, mode: "insensitive" } },
          { lrn: { contains: needle, mode: "insensitive" } },
          { section: { name: { contains: needle, mode: "insensitive" } } },
        ],
      }
    : null;

  const sectionMatch = {
    ...(schoolYearId ? { schoolYearId } : {}),
    ...(section ? { name: section } : {}),
  };

  const [profiles, rosterEntries] = await Promise.all([
    prisma.studentProfile.findMany({
      where: {
        AND: [
          { section: sectionMatch },
          ...(profileSearch ? [profileSearch] : []),
        ],
      },
      orderBy: { lrn: "asc" },
      take: 5000,
      select: {
        userId: true,
        lrn: true,
        section: { select: { id: true, name: true } },
        user: { select: { fullName: true } },
        finalGrades: {
          where: termId ? { termId } : undefined,
          select: { computedAverage: true, transmutedGrade: true },
        },
        attendanceRecords: {
          where: termId ? { termId } : undefined,

          select: { status: true, subjectId: true },
        },
        anecdotalRecords: { where: termId ? { termId } : undefined, select: { id: true } },
      },
    }),
    prisma.studentRoster.findMany({
      where: {
        AND: [
          {
            ...(schoolYearId ? { schoolYearId } : {}),
            ...(section ? { section: { name: section } } : {}),
          },
          ...(rosterSearch ? [rosterSearch] : []),
        ],
      },
      orderBy: { lrn: "asc" },
      take: 5000,
      select: {
        id: true,
        lrn: true,
        fullName: true,
        sectionId: true,
        section: { select: { name: true } },
        finalGrades: {
          where: termId ? { termId } : undefined,
          select: { computedAverage: true, transmutedGrade: true },
        },
        attendanceRecords: {
          where: termId ? { termId } : undefined,
          select: { status: true, subjectId: true },
        },
        anecdotalRecords: { where: termId ? { termId } : undefined, select: { id: true } },
      },
    }),
  ]);
  const registeredLrns = new Set(profiles.map((s) => s.lrn));

  const sectionIds = Array.from(
    new Set([
      ...profiles.map((s) => s.section?.id).filter(Boolean),
      ...rosterEntries.map((r) => r.sectionId),
    ]),
  ) as string[];
  const headcounts = await sectionHeadcounts(sectionIds);

  type Candidate = {
    studentId: string;
    lrn: string;
    name: string;
    section: string;
    finalGrades: { computedAverage: number | null; transmutedGrade: number | null }[];
    attendanceRecords: { status: string; subjectId: string | null }[];
    anecdotalCount: number;
    enrolled: number;
  };
  const candidates: Candidate[] = [
    ...profiles.map((s) => ({
      studentId: s.userId,
      lrn: s.lrn,
      name: s.user.fullName,
      section: s.section?.name ?? "—",
      finalGrades: s.finalGrades,
      attendanceRecords: s.attendanceRecords,
      anecdotalCount: s.anecdotalRecords.length,
      enrolled: headcounts.get(s.section?.id ?? "") ?? 0,
    })),
    ...rosterEntries
      .filter((r) => !registeredLrns.has(r.lrn))
      .map((r) => ({
        studentId: `roster:${r.id}`,
        lrn: r.lrn,
        name: r.fullName,
        section: r.section?.name ?? "—",
        finalGrades: r.finalGrades,
        attendanceRecords: r.attendanceRecords,
        anecdotalCount: r.anecdotalRecords.length,
        enrolled: headcounts.get(r.sectionId) ?? 0,
      })),
  ];

  const students: RiskStudentRow[] = candidates.map((s) => {

    const flags = computeRiskFactors({
      finalGrades: s.finalGrades,
      attendance: s.attendanceRecords,
      anecdotalCount: s.anecdotalCount,
      enrolled: s.enrolled,
    });
    const liveLevel = levelFromFlags(flags);
    const liveCount =
      (flags.academicFlag ? 1 : 0) +
      (flags.attendanceFlag ? 1 : 0) +
      (flags.behavioralFlag ? 1 : 0);
    return {
      studentId: s.studentId,
      lrn: s.lrn,
      name: s.name,
      section: s.section,
      riskLevel: liveLevel,
      riskCount: liveCount,
      factors: {
        Academic: flags.academicFlag,
        Attendance: flags.attendanceFlag,
        Behavioral: flags.behavioralFlag,
      },
    };
  });

  students.sort(
    (a, b) => LEVEL_RANK[b.riskLevel] - LEVEL_RANK[a.riskLevel] || a.lrn.localeCompare(b.lrn),
  );

  // Default to true at-risk only (High + Moderate). Explicit ?riskLevel=Low still works.
  // Default to true at-risk only (High + Moderate). Explicit filter overrides.
  const scoped = students.filter(
    (s) =>
      (extra?.riskLevel ? s.riskLevel === extra.riskLevel : s.riskLevel !== "Low") &&
      (!extra?.factor || s.factors[extra.factor] === true),
  );

  const total = scoped.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const slice = scoped.slice((safePage - 1) * pageSize, safePage * pageSize);

  return { students: slice, total, page: safePage, pageSize };
}
