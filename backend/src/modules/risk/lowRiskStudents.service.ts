import { prisma } from "../../lib/prisma.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { sectionHeadcounts } from "../../services/enrollment.js";

export interface LowRiskStudent {
  lrn: string;
  name: string;
}

export interface LowRiskResult {
  students: LowRiskStudent[];
  total: number;
  page: number;
  pageSize: number;
}

// Low-risk students in the active school year, paginated. Risk is derived
// live with the same factor rules as the risk list (no flags = Low) so
// enlisted students without accounts are included on equal footing.
export async function getLowRiskStudents(
  page: number,
  pageSize: number
): Promise<LowRiskResult> {
  const termId = await resolveActiveTermId();
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  const schoolYearId = schoolYear?.id;

  const [profiles, rosterEntries] = await Promise.all([
    prisma.studentProfile.findMany({
      where: schoolYearId ? { section: { schoolYearId } } : undefined,
      orderBy: { lrn: "asc" },
      select: {
        lrn: true,
        user: { select: { fullName: true } },
        section: { select: { id: true } },
        finalGrades: {
          where: termId ? { termId } : undefined,
          select: { computedAverage: true, transmutedGrade: true },
        },
        attendanceRecords: { where: termId ? { termId } : undefined, select: { status: true } },
        anecdotalRecords: { where: termId ? { termId } : undefined, select: { id: true } },
      },
    }),
    prisma.studentRoster.findMany({
      where: schoolYearId ? { schoolYearId } : undefined,
      orderBy: { lrn: "asc" },
      select: {
        lrn: true,
        fullName: true,
        sectionId: true,
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

  type Candidate = {
    lrn: string;
    name: string;
    finalGrades: { computedAverage: number | null; transmutedGrade: number | null }[];
    attendanceRecords: { status: string }[];
    anecdotalCount: number;
    enrolled: number;
  };
  const candidates: Candidate[] = [
    ...profiles.map((s) => ({
      lrn: s.lrn,
      name: s.user.fullName,
      finalGrades: s.finalGrades,
      attendanceRecords: s.attendanceRecords,
      anecdotalCount: s.anecdotalRecords.length,
      enrolled: headcounts.get(s.section?.id ?? "") ?? 0,
    })),
    ...rosterEntries
      .filter((r) => !registeredLrns.has(r.lrn))
      .map((r) => ({
        lrn: r.lrn,
        name: r.fullName,
        finalGrades: r.finalGrades,
        attendanceRecords: r.attendanceRecords,
        anecdotalCount: r.anecdotalRecords.length,
        enrolled: headcounts.get(r.sectionId) ?? 0,
      })),
  ];

  const low = candidates.filter((s) => {
    const avg =
      s.finalGrades.length > 0
        ? s.finalGrades.reduce((sum, g) => sum + (g.transmutedGrade ?? 0), 0) /
          s.finalGrades.length
        : 100;
    const academic = avg < 75;
    const present = s.attendanceRecords.filter((a) => a.status === "present").length;
    const attendance = s.enrolled > 0 && present / s.enrolled < 0.8;
    const behavioral = s.anecdotalCount > 0;
    return !academic && !attendance && !behavioral;
  });

  low.sort((a, b) => a.lrn.localeCompare(b.lrn));

  const total = low.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const slice = low.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    students: slice.map((r) => ({ lrn: r.lrn, name: r.name })),
    total,
    page: safePage,
    pageSize,
  };
}
