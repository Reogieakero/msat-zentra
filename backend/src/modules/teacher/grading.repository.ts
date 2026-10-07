import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { invalidateTags } from "../../lib/cache.js";
import {
  finalKeysForSubjectTerm,
  recomputeSubjectFinal,
  type StudentKey,
} from "../../services/grading.js";
import { recomputeRisk, recomputeRosterRisk } from "../../services/risk.js";

// Shared gradebook data-access: labels, ownership gates, and the
// finals/risk refresh that follows every gradebook mutation. Endpoint
// orchestration lives in src/services/teacher/grading.service.ts.

export const COMPONENT_LABELS: Record<string, string> = {
  WRITTEN_WORK: "WW",
  PERFORMANCE_TASK: "PT",
  EXAM: "E",
};

// Recompute finals for the given students (or every holder when keys are
// omitted) and refresh their risk rows. Keeps every downstream view —
// workspace finals, academic records, pipelines — live on each mutation.
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
  // Recomputes above can open guidance interventions + risk levels.
  await invalidateTags(["teacher", "registrar", "academics", "overview", "principal", "risk", "guidance"]);
}

// Grade components are school-wide per (subject, term), so ownership for
// component/assessment management means: the caller must hold at least one
// TeacherSubjectAssignment for that subject + term (any section).
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

// A class is one TeacherSubjectAssignment row (subject × section × term) that
// must belong to the caller — 404 otherwise (uniform, no probing). Linked
// timetable classes address it as `subjectId|sectionId`; those resolve to the
// caller's assignment row for the given term.
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
    // Code-linked teachers (My Classes / Attendance link code) often have no
    // assignment row — their classes come from committed timetable slots
    // attached to their linked teacher-list name. Resolve the same
    // (subject, section) through that link so the workspace opens instead of
    // 404ing. The composite id is kept as `id` so every later call under
    // /classes/:assignmentId (weights, presets, assessments) resolves the
    // same way; grade components are keyed by subject + term, shared.
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
