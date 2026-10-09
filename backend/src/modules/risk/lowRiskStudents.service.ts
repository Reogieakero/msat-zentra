import { prisma } from "../../lib/prisma.js";
import { computeRiskFactors, levelFromFlags, resolveActiveTermId } from "../../services/risk.js";
import { sectionHeadcounts } from "../../services/enrollment.js";
import type { TermScopeInput } from "../../lib/termScope.js";

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

// Real-time unified: Low = live levelFromFlags === "Low" (EITHER avg < 75).
export async function getLowRiskStudents(
  page: number,
  pageSize: number,
  scope?: TermScopeInput,
  q?: string,
): Promise<LowRiskResult> {
  const effPageSize = Math.min(Math.max(1, Math.floor(pageSize) || 15), 15);
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
        ],
      }
    : null;
  const rosterSearch: any = needle
    ? {
        OR: [
          { fullName: { contains: needle, mode: "insensitive" } },
          { lrn: { contains: needle, mode: "insensitive" } },
        ],
      }
    : null;

  const [profiles, rosters] = await Promise.all([
    prisma.studentProfile.findMany({
      where: {
        AND: [
          ...(schoolYearId ? [{ section: { schoolYearId } }] : []),
          ...(profileSearch ? [profileSearch] : []),
        ],
      },
      orderBy: { lrn: "asc" },
      take: 5000,
      select: {
        lrn: true,
        user: { select: { fullName: true } },
        section: { select: { id: true } },
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
          ...(schoolYearId ? [{ schoolYearId }] : []),
          ...(rosterSearch ? [rosterSearch] : []),
        ],
      },
      orderBy: { lrn: "asc" },
      take: 5000,
      select: {
        lrn: true,
        fullName: true,
        sectionId: true,
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

  const registered = new Set(profiles.map((p) => p.lrn));
  const sectionIds = Array.from(
    new Set([
      ...profiles.map((p) => p.section?.id).filter((v): v is string => !!v),
      ...rosters.map((r) => r.sectionId),
    ]),
  );
  const headcounts = await sectionHeadcounts(sectionIds);

  const lows: LowRiskStudent[] = [];
  for (const p of profiles) {
    const flags = computeRiskFactors({
      finalGrades: p.finalGrades,
      attendance: p.attendanceRecords,
      anecdotalCount: p.anecdotalRecords.length,
      enrolled: headcounts.get(p.section?.id ?? "") ?? 0,
    });
    if (levelFromFlags(flags) === "Low") lows.push({ lrn: p.lrn, name: p.user.fullName });
  }
  for (const r of rosters) {
    if (registered.has(r.lrn)) continue;
    const flags = computeRiskFactors({
      finalGrades: r.finalGrades,
      attendance: r.attendanceRecords,
      anecdotalCount: r.anecdotalRecords.length,
      enrolled: headcounts.get(r.sectionId) ?? 0,
    });
    if (levelFromFlags(flags) === "Low") lows.push({ lrn: r.lrn, name: r.fullName });
  }

  lows.sort((a, b) => a.lrn.localeCompare(b.lrn));
  const total = lows.length;
  const totalPages = Math.max(1, Math.ceil(total / effPageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const students = lows.slice((safePage - 1) * effPageSize, safePage * effPageSize);

  return { students, total, page: safePage, pageSize: effPageSize };
}
