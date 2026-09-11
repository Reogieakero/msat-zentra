import { prisma } from "../../lib/prisma.js";
import { resolveActiveTermId, type GradeMode } from "../../services/risk.js";
import { sectionHeadcounts } from "../../services/enrollment.js";

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

// Principal: full at-risk student list (status-only factors, no confidential
// fields) for the active school year. Optional section filter. `gradeMode`
// selects whether the academic factor uses final (transmuted) or raw averages.
// Enlisted students without accounts are included on equal footing.
export async function getRiskStudents(
  page: number,
  pageSize: number,
  section?: string,
  gradeMode: GradeMode = "final"
): Promise<RiskStudentsResult> {
  const termId = await resolveActiveTermId();
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  const schoolYearId = schoolYear?.id;

  const sectionMatch = {
    ...(schoolYearId ? { schoolYearId } : {}),
    ...(section ? { name: section } : {}),
  };

  const [profiles, rosterEntries] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { section: sectionMatch },
      orderBy: { lrn: "asc" },
      select: {
        userId: true,
        lrn: true,
        section: { select: { id: true, name: true } },
        user: { select: { fullName: true } },
        finalGrades: {
          where: termId ? { termId } : undefined,
          select: { computedAverage: true, transmutedGrade: true },
        },
        attendanceRecords: { where: termId ? { termId } : undefined, select: { status: true } },
        anecdotalRecords: { where: termId ? { termId } : undefined, select: { id: true } },
      },
    }),
    prisma.studentRoster.findMany({
      where: {
        ...(schoolYearId ? { schoolYearId } : {}),
        ...(section ? { section: { name: section } } : {}),
      },
      orderBy: { lrn: "asc" },
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
        attendanceRecords: { where: termId ? { termId } : undefined, select: { status: true } },
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

  const gradeOf = (g: { computedAverage: number | null; transmutedGrade: number | null }) =>
    gradeMode === "raw" ? g.computedAverage : g.transmutedGrade;

  type Candidate = {
    studentId: string;
    lrn: string;
    name: string;
    section: string;
    finalGrades: { computedAverage: number | null; transmutedGrade: number | null }[];
    attendanceRecords: { status: string }[];
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
    const avg =
      s.finalGrades.length > 0
        ? s.finalGrades.reduce((sum, g) => sum + (gradeOf(g) ?? 0), 0) /
          s.finalGrades.length
        : 100;
    const present = s.attendanceRecords.filter((a) => a.status === "present").length;
    const academic = avg < 75;
    const attendance = s.enrolled > 0 && present / s.enrolled < 0.8;
    const behavioral = s.anecdotalCount > 0;
    // Derive level + count from the live factors so the list always matches
    // the engine rule (risk.ts): >=2 = High, 1 = Moderate, 0 = Low. The stored
    // profile columns can be stale, so we never trust them here.
    const liveCount =
      (academic ? 1 : 0) + (attendance ? 1 : 0) + (behavioral ? 1 : 0);
    const liveLevel: string =
      liveCount >= 2 ? "High" : liveCount === 1 ? "Moderate" : "Low";
    return {
      studentId: s.studentId,
      lrn: s.lrn,
      name: s.name,
      section: s.section,
      riskLevel: liveLevel,
      riskCount: liveCount,
      factors: { Academic: academic, Attendance: attendance, Behavioral: behavioral },
    };
  });

  students.sort(
    (a, b) => LEVEL_RANK[b.riskLevel] - LEVEL_RANK[a.riskLevel] || a.lrn.localeCompare(b.lrn),
  );

  const total = students.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const slice = students.slice((safePage - 1) * pageSize, safePage * pageSize);

  return { students: slice, total, page: safePage, pageSize };
}
