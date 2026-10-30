import { prisma } from "../lib/prisma.js";
import type { GradeLevel } from "../generated/prisma/client.js";

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

export async function sectionHeadcounts(
  sectionIds: string[],
  preloadedProfileGroups?: { sectionId: string | null; _count: { _all: number } }[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>(sectionIds.map((id) => [id, 0]));
  if (sectionIds.length === 0) return counts;
  const [profileGroups, rosterCounts] = await Promise.all([
    preloadedProfileGroups ??
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

/**
 * Per-section learner count that matches the principal's section student list:
 * registered profiles in the section + roster entries whose LRN is not already
 * registered *in that same section*. `sectionHeadcounts` de-dupes LRNs school-
 * wide, which hides a roster learner whenever an unrelated profile elsewhere
 * happens to carry the same LRN (seed/data-entry artifacts), so a section with
 * 4 listed learners could report 1.
 */
export async function sectionEnrollmentCounts(
  sectionIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>(sectionIds.map((id) => [id, 0]));
  if (sectionIds.length === 0) return counts;

  const [profiles, rosters] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { sectionId: true, lrn: true },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { sectionId: true, lrn: true },
    }),
  ]);

  const registeredBySection = new Map<string, Set<string>>();
  for (const p of profiles) {
    if (!p.sectionId) continue;
    const set = registeredBySection.get(p.sectionId) ?? new Set<string>();
    set.add(p.lrn);
    registeredBySection.set(p.sectionId, set);
    counts.set(p.sectionId, (counts.get(p.sectionId) ?? 0) + 1);
  }
  for (const r of rosters) {
    if (!r.sectionId) continue;
    if (registeredBySection.get(r.sectionId)?.has(r.lrn)) continue;
    counts.set(r.sectionId, (counts.get(r.sectionId) ?? 0) + 1);
  }
  return counts;
}

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

export async function totalRosterHeadcount(schoolYearId?: string | null): Promise<number> {
  const yearId = schoolYearId === undefined ? await activeYearId() : schoolYearId;
  const rows = await prisma.studentRoster.findMany({
    where: yearId ? { schoolYearId: yearId } : {},
    select: { lrn: true },
  });
  const registered = await registeredLrns(rows.map((r) => r.lrn));
  return rows.filter((r) => !registered.has(r.lrn)).length;
}
