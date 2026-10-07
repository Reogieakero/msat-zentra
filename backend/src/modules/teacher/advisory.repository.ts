import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";

// Shared advisory data-access: filer roles, the adviser gate, teachable
// section resolution, and the pure adviser-name matcher. Endpoint
// orchestration lives in src/services/advisory/*.service.ts.
//
// Moved here from advisory.routes.ts so other modules (attendance,
// teacher directory) import data-access from data-access — never from a
// routes file.

export const TEACHER_ROLES = ["subject_teacher", "adviser"] as const;

// Pure gate: adviser-only surfaces 404 unless the teacher advises ≥1 section.
// Throws AppError so it stays unit-testable without a DB.
export function requireAdvisorySections<T extends { id: string }>(sections: T[]): T[] {
  if (sections.length === 0) {
    throw new AppError(404, "NOT_ADVISER", "No advisory section assigned");
  }
  return sections;
}

export async function adviserSectionsOr404(teacherId: string, schoolYearId?: string | null) {
  const sections = await prisma.section.findMany({
    // Year-scoped: last year's advisership never authorizes this year's desk.
    where: { adviserId: teacherId, ...(schoolYearId ? { schoolYearId } : {}) },
    select: { id: true, name: true, gradeLevel: true },
  });
  return requireAdvisorySections(sections);
}

// Every section a teacher may take attendance for: advisory sections, plus
// sections from their subject assignments, plus sections from timetable
// slots attached to their linked teacher-list code (committed slots only).
// Union — never throws, so code-claimed subject teachers without advisory
// load or assignment rows still resolve their own classes.
export async function teachableSectionIds(teacherId: string, termId?: string | null, schoolYearId?: string | null): Promise<string[]> {
  const [advisory, assigned, linked] = await Promise.all([
    adviserSectionsOr404(teacherId, schoolYearId).catch(() => [] as { id: string }[]),
    prisma.teacherSubjectAssignment.findMany({
      where: { teacherId, ...(termId ? { termId } : {}) },
      select: { sectionId: true },
    }),
    prisma.sectionTimetableEntry.findMany({
      where: {
        ...(termId ? { termId } : {}),
        status: { in: ["APPROVED", "SUBMITTED"] },
        teacherName: { userId: teacherId },
      },
      select: { sectionId: true },
      distinct: ["sectionId"],
    }),
  ]);
  return [
    ...new Set([
      ...advisory.map((s) => s.id),
      ...assigned.map((a) => a.sectionId),
      ...linked.map((l) => l.sectionId),
    ]),
  ];
}

// Pure adviser-name match: the principal files sections under a free-text
// adviser name, and the teacher claims the section by matching their account
// name against it. Trimmed + case-insensitive so "juan dela cruz" matches
// "Juan Dela Cruz". Pure so it stays unit-testable without a DB.
export function matchesAdviserName(adviserLabel: string | null | undefined, fullName: string): boolean {
  if (!adviserLabel || !fullName) return false;
  return adviserLabel.trim().toLowerCase() === fullName.trim().toLowerCase();
}
