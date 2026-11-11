import { prisma } from "./prisma.js";

export interface TeacherGrantInfo {
  id: string;
  termId: string;
  via: string;
  attendanceVerifiedAt: Date | null;
}

/**
 * Resolve the teacher code grant that opens a term.
 *
 * Classes, grading and attendance are school-year desks (the same subjects,
 * sections and advisees run through all three terms), so entering the code
 * once on /teacher/classes opens every term of that school year. A grant
 * recorded on any term of the selected term's school year therefore satisfies
 * the selected term too.
 */
export async function findTeacherTermGrant(
  userId: string,
  termId: string,
): Promise<TeacherGrantInfo | null> {
  const select = { id: true, termId: true, via: true, attendanceVerifiedAt: true } as const;
  const exact = await prisma.teacherTermGrant.findUnique({
    where: { userId_termId: { userId, termId } },
    select,
  });
  if (exact) return exact;

  const term = await prisma.term.findUnique({
    where: { id: termId },
    select: { schoolYearId: true },
  });
  if (!term) return null;
  return prisma.teacherTermGrant.findFirst({
    where: { userId, term: { schoolYearId: term.schoolYearId } },
    select,
    orderBy: [{ attendanceVerifiedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });
}
