import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { GradeLevel } from "../../generated/prisma/client.js";
import { gradeToNumber } from "../../lib/grades.js";
import { mintAdviserCode } from "./adviserCode.js";

export function toGradeEnum(n: number): GradeLevel {
  if (n === 7) return "G7";
  if (n === 8) return "G8";
  if (n === 9) return "G9";
  if (n === 10) return "G10";
  if (n === 11) return "G11";
  if (n === 12) return "G12";
  throw new AppError(400, "INVALID_GRADE_LEVEL", "Grade level must be 7–12");
}

export async function resolveScopeYear(req: {
  termScope?: { schoolYearId?: string | null };
}): Promise<{ id: string; name: string }> {
  const scoped = req.termScope?.schoolYearId ?? null;
  if (scoped) {
    const found = await prisma.schoolYear.findUnique({
      where: { id: scoped },
      select: { id: true, name: true },
    });
    if (!found) throw new AppError(404, "SCHOOL_YEAR_NOT_FOUND", "School year not found");
    return found;
  }
  const active = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  if (!active) throw new AppError(404, "SCHOOL_YEAR_NOT_FOUND", "No school year found");
  return active;
}

export function toCategoryLabel(category: string): "Core" | "Elective" {
  return category === "ELECTIVE" ? "Elective" : "Core";
}

export function toAdviserResult(updated: {
  id: string;
  name: string;
  gradeLevel: string;
  schoolYearId: string;
  adviserId: string | null;
  adviserLabel: string | null;
  adviserCode?: string | null;
  adviser: { fullName: string } | null;
  schoolYear: { name: string } | null;
}) {
  return {
    id: updated.id,
    name: updated.name,
    gradeLevel: gradeToNumber(updated.gradeLevel),
    schoolYear: updated.schoolYear?.name ?? "",
    schoolYearId: updated.schoolYearId,
    adviserId: updated.adviserId ?? "",
    adviserName: updated.adviser?.fullName ?? updated.adviserLabel ?? "",
    adviserLabel: updated.adviserLabel ?? "",
    adviserCode: updated.adviserCode ?? "",
  };
}

export async function mintUniqueAdviserCode(exclude?: Set<string>): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = mintAdviserCode();
    if (exclude?.has(candidate)) continue;
    const clash = await prisma.section.findUnique({
      where: { adviserCode: candidate },
      select: { id: true },
    });
    if (!clash) {
      exclude?.add(candidate);
      return candidate;
    }
  }
  throw new AppError(500, "CODE_MINT_FAILED", "Could not mint a unique advisory code, try again");
}

export function assertInScope(req: { termScope?: { schoolYearId?: string | null } }, schoolYearId: string) {
  const scopeYearId = req.termScope?.schoolYearId ?? null;
  if (scopeYearId && schoolYearId !== scopeYearId) {
    throw new AppError(
      403,
      "SCOPE_MISMATCH",
      "Section is outside the active school year"
    );
  }
}

export interface SectionLinkCounts {
  students: number;
  records: number;
}

/**
 * Students + records hanging off each section. The principal's assign desk
 * uses this to lock Change / Clear / Delete once a section carries a learner
 * list or any record — same linked rows the delete guard checks.
 */
export async function sectionLinkCounts(
  sectionIds: string[],
): Promise<Map<string, SectionLinkCounts>> {
  const counts = new Map<string, SectionLinkCounts>();
  for (const id of sectionIds) counts.set(id, { students: 0, records: 0 });
  if (sectionIds.length === 0) return counts;

  const where = { sectionId: { in: sectionIds } };
  const [profiles, roster, assignments, attendance, anecdotal, flags, sf10] = await Promise.all([
    prisma.studentProfile.groupBy({ by: ["sectionId"], where, _count: { _all: true } }),
    prisma.studentRoster.groupBy({ by: ["sectionId"], where, _count: { _all: true } }),
    prisma.teacherSubjectAssignment.groupBy({ by: ["sectionId"], where, _count: { _all: true } }),
    prisma.attendanceRecord.groupBy({ by: ["sectionId"], where, _count: { _all: true } }),
    prisma.anecdotalRecord.groupBy({ by: ["sectionId"], where, _count: { _all: true } }),
    prisma.gradeFlag.groupBy({ by: ["sectionId"], where, _count: { _all: true } }),
    prisma.adviserSf10AccessRequest.groupBy({ by: ["sectionId"], where, _count: { _all: true } }),
  ]);

  const add = (
    rows: { sectionId: string | null; _count: { _all: number } }[],
    key: keyof SectionLinkCounts,
  ) => {
    for (const row of rows) {
      const entry = row.sectionId ? counts.get(row.sectionId) : undefined;
      if (entry) entry[key] += row._count._all;
    }
  };

  add(profiles, "students");
  add(roster, "students");
  add(assignments, "records");
  add(attendance, "records");
  add(anecdotal, "records");
  add(flags, "records");
  add(sf10, "records");
  return counts;
}
