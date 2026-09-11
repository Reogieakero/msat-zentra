import { prisma } from "../lib/prisma.js";
import type { GradeLevel } from "../generated/prisma/client.js";

// Roster-aware enrollment headcounts.
//
// A student counts exactly once: registered student_profiles, plus roster
// enlistments whose LRN has no profile yet (matched by LRN, mirroring the
// advisory roster list). Account status never excludes anyone — an enlisted
// student counts whether or not they have logged in.
//
// Profile queries keep their existing semantics; roster rows (which are
// school-year scoped) are added on top, defaulting to the active year.

async function registeredLrns(lrns: string[]): Promise<Set<string>> {
  if (lrns.length === 0) return new Set();
  const profiles = await prisma.studentProfile.findMany({
    where: { lrn: { in: lrns } },
    select: { lrn: true },
  });
  return new Set(profiles.map((p) => p.lrn));
}

async function activeYearId(): Promise<string | null> {
  const year = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  return year?.id ?? null;
}

// Unregistered roster headcount per section id. Only rows in schoolYearId
// (default: active year) are considered.
export async function rosterCountsBySection(
  sectionIds: string[],
  schoolYearId?: string | null,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (sectionIds.length === 0) return counts;
  const yearId = schoolYearId === undefined ? await activeYearId() : schoolYearId;
  const rows = await prisma.studentRoster.findMany({
    where: {
      sectionId: { in: sectionIds },
      ...(yearId ? { schoolYearId: yearId } : {}),
    },
    select: { lrn: true, sectionId: true },
  });
  const registered = await registeredLrns(rows.map((r) => r.lrn));
  for (const r of rows) {
    if (!registered.has(r.lrn)) counts.set(r.sectionId, (counts.get(r.sectionId) ?? 0) + 1);
  }
  return counts;
}

// Profile + roster headcount per section id.
export async function sectionHeadcounts(sectionIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>(sectionIds.map((id) => [id, 0]));
  if (sectionIds.length === 0) return counts;
  const [profileGroups, rosterCounts] = await Promise.all([
    prisma.studentProfile.groupBy({
      by: ["sectionId"],
      where: { sectionId: { in: sectionIds } },
      _count: { _all: true },
    }),
    rosterCountsBySection(sectionIds),
  ]);
  for (const g of profileGroups) {
    if (g.sectionId) counts.set(g.sectionId, (counts.get(g.sectionId) ?? 0) + g._count._all);
  }
  for (const [id, n] of rosterCounts) counts.set(id, (counts.get(id) ?? 0) + n);
  return counts;
}

// Unregistered roster headcount per grade level. Only rows in schoolYearId
// (default: active year) are considered.
export async function rosterCountsByGrade(
  grades: GradeLevel[],
  schoolYearId?: string | null,
): Promise<Map<GradeLevel, number>> {
  const counts = new Map<GradeLevel, number>();
  if (grades.length === 0) return counts;
  const yearId = schoolYearId === undefined ? await activeYearId() : schoolYearId;
  const rows = await prisma.studentRoster.findMany({
    where: {
      gradeLevel: { in: grades },
      ...(yearId ? { schoolYearId: yearId } : {}),
    },
    select: { lrn: true, gradeLevel: true },
  });
  const registered = await registeredLrns(rows.map((r) => r.lrn));
  for (const r of rows) {
    if (!registered.has(r.lrn)) counts.set(r.gradeLevel, (counts.get(r.gradeLevel) ?? 0) + 1);
  }
  return counts;
}

// Total unregistered roster headcount (default: active year).
export async function totalRosterHeadcount(schoolYearId?: string | null): Promise<number> {
  const yearId = schoolYearId === undefined ? await activeYearId() : schoolYearId;
  const rows = await prisma.studentRoster.findMany({
    where: yearId ? { schoolYearId: yearId } : {},
    select: { lrn: true },
  });
  const registered = await registeredLrns(rows.map((r) => r.lrn));
  return rows.filter((r) => !registered.has(r.lrn)).length;
}
