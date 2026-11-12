import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { isArchivedAdvisoryLearner } from "../../lib/learnerVisibility.js";

export async function assertAdvisee(teacherId: string, studentId: string) {
  const student = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
    include: {
      user: { select: { fullName: true } },
      section: { select: { id: true, name: true, adviserId: true } },
    },
  });
  if (!student || student.section?.adviserId !== teacherId) {
    throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  }
  // Adviser-scoped soft delete: a hidden learner's per-student endpoints must
  // behave as if they do not exist (deep links / stale overlays included).
  if (await isArchivedAdvisoryLearner({ studentId })) {
    throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  }
  return student;
}
