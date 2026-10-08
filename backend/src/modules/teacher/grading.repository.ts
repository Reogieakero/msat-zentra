import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { invalidateTags } from "../../lib/cache.js";
import {
  finalKeysForSubjectTerm,
  recomputeSubjectFinal,
  type StudentKey,
} from "../../services/grading.js";
import { recomputeRisk, recomputeRosterRisk } from "../../services/risk.js";

export const COMPONENT_LABELS: Record<string, string> = {
  WRITTEN_WORK: "WW",
  PERFORMANCE_TASK: "PT",
  EXAM: "E",
};

export async function refreshFinals(
  subjectId: string,
  termId: string,
  keys?: StudentKey[],
): Promise<void> {
  const targets = keys ?? (await finalKeysForSubjectTerm(subjectId, termId));
  await Promise.all(targets.map((k) => recomputeSubjectFinal(k, subjectId, termId)));
  const profileIds = Array.from(
    new Set(targets.flatMap((k) => ("studentId" in k ? [k.studentId] : []))),
  );
  const rosterIds = Array.from(
    new Set(targets.flatMap((k) => ("rosterId" in k ? [k.rosterId] : []))),
  );
  await Promise.all(profileIds.map((id) => recomputeRisk(id, termId)));
  await Promise.all(rosterIds.map((id) => recomputeRosterRisk(id, termId)));
}

export async function invalidateGradingCaches(): Promise<void> {

  await invalidateTags(["teacher", "registrar", "academics", "overview", "principal", "risk", "guidance"]);
}

export async function assertSubjectAccess(teacherId: string, subjectId: string, termId: string) {
  const assignment = await prisma.teacherSubjectAssignment.findFirst({
    where: { teacherId, subjectId, termId },
    select: { id: true },
  });
  if (!assignment) {
    throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
  }
  return assignment;
}

export async function assertAssignment(teacherId: string, assignmentId: string, termId: string) {
  const include = {
    subject: { select: { id: true, code: true, name: true, gradeLevel: true, category: true } },
    section: { select: { id: true, name: true, gradeLevel: true } },
    term: {
      select: { id: true, termNumber: true, schoolYear: { select: { id: true, name: true } } },
    },
  } as const;
  const sep = assignmentId.indexOf("|");
  if (sep >= 0) {
    const subjectId = assignmentId.slice(0, sep);
    const sectionId = assignmentId.slice(sep + 1);
    const assignment = await prisma.teacherSubjectAssignment.findFirst({
      where: {
        teacherId,
        subjectId,
        sectionId,
        termId,
      },
      include,
    });
    if (assignment) return assignment;

    const linked = await prisma.sectionTimetableEntry.findFirst({
      where: {
        termId,
        subjectId,
        sectionId,
        status: { in: ["APPROVED", "SUBMITTED"] },
        teacherName: { userId: teacherId },
      },
      select: { subjectId: true, sectionId: true },
    });
    if (!linked) {
      throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
    }
    const [subject, section, term] = await Promise.all([
      prisma.subject.findUnique({
        where: { id: subjectId },
        select: { id: true, code: true, name: true, gradeLevel: true, category: true },
      }),
      prisma.section.findUnique({
        where: { id: sectionId },
        select: { id: true, name: true, gradeLevel: true },
      }),
      prisma.term.findUnique({
        where: { id: termId },
        select: { id: true, termNumber: true, schoolYear: { select: { id: true, name: true } } },
      }),
    ]);
    if (!subject || !section || !term) {
      throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
    }
    return { id: assignmentId, teacherId, subjectId, sectionId, termId, subject, section, term };
  }
  const assignment = await prisma.teacherSubjectAssignment.findUnique({
    where: { id: assignmentId },
    include,
  });
  if (!assignment || assignment.teacherId !== teacherId) {
    throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
  }
  return assignment;
}

export async function resolveTermOrThrow(termId: string | null) {
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  return termId;
}
