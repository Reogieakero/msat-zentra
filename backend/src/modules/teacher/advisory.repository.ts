import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";

export const TEACHER_ROLES = ["subject_teacher", "adviser"] as const;

export function requireAdvisorySections<T extends { id: string }>(sections: T[]): T[] {
  if (sections.length === 0) {
    throw new AppError(404, "NOT_ADVISER", "No advisory section assigned");
  }
  return sections;
}

export async function adviserSectionsOr404(teacherId: string, schoolYearId?: string | null) {
  const sections = await prisma.section.findMany({

    where: { adviserId: teacherId, ...(schoolYearId ? { schoolYearId } : {}) },
    select: { id: true, name: true, gradeLevel: true },
  });
  return requireAdvisorySections(sections);
}

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

export function matchesAdviserName(adviserLabel: string | null | undefined, fullName: string): boolean {
  if (!adviserLabel || !fullName) return false;
  return adviserLabel.trim().toLowerCase() === fullName.trim().toLowerCase();
}
