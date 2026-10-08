import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";

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
  return student;
}
