import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { adviserSectionsOr404 } from "../../modules/teacher/advisory.repository.js";

export interface OfferedSubjectsQuery {
  teacherId: string;
  callerRole: string;
  sectionId: string;
  termId?: string;
}

// Offered subjects for a section+term (assignment-backed) with the caller's
// mark permission. Powers the teacher subject selector — the ONLY source of
// valid subjectId values for POST /bulk.
export async function getOfferedSubjects(query: OfferedSubjectsQuery) {
  const { teacherId, callerRole, sectionId } = query;
  let { termId } = query;
  if (!termId) {
    return { subjects: [] };
  }

  const offerings = await prisma.teacherSubjectAssignment.findMany({
    where: { sectionId, termId },
    include: {
      subject: { select: { id: true, name: true, code: true, gradeLevel: true } },
      teacher: { select: { fullName: true } },
    },
    orderBy: { subject: { name: "asc" } },
  });

  let advisoryOk = false;
  if (callerRole === "adviser" || callerRole === "principal") {
    if (callerRole === "principal") {
      advisoryOk = true;
    } else {
      try {
        const sections = await adviserSectionsOr404(teacherId);
        advisoryOk = sections.some((s) => s.id === sectionId);
      } catch {
        advisoryOk = false;
      }
    }
  }

  // Committed timetable subjects attached to the caller's linked
  // teacher-list code — one batched read, so claimed subject teachers
  // can mark their own classes without assignment rows.
  const linkedSubjectIds =
    callerRole !== "adviser" && callerRole !== "principal"
      ? new Set(
          (
            await prisma.sectionTimetableEntry.findMany({
              where: {
                sectionId,
                termId,
                status: { in: ["APPROVED", "SUBMITTED"] },
                teacherName: { userId: teacherId },
              },
              select: { subjectId: true },
              distinct: ["subjectId"],
            })
          ).map((e) => e.subjectId)
        )
      : new Set<string>();
  const seen = new Map<string, (typeof offerings)[number]>();
  for (const o of offerings) {
    if (!seen.has(o.subjectId)) seen.set(o.subjectId, o);
  }
  return {
    sectionId,
    termId,
    subjects: [...seen.values()].map((o) => ({
      assignmentId: o.id,
      subjectId: o.subject.id,
      code: o.subject.code,
      name: o.subject.name,
      gradeLevel: o.subject.gradeLevel,
      teacherId: o.teacherId,
      teacherName: o.teacher.fullName,
      canMark:
        callerRole === "principal"
          ? false
          : callerRole === "adviser"
            ? advisoryOk
            : o.teacherId === teacherId || linkedSubjectIds.has(o.subjectId),
    })),
  };
}

export interface SubjectDaysQuery {
  sectionId: string;
  subjectId: string;
  mineOnly: boolean;
  termId: string;
  teacherId: string;
  allowed: boolean;
}

// Per-student, per-day subject marks for the active term plus the term
// range — feeds the meetup blocks view (one heatblock per scheduled meetup
// day of the subject, term-scoped). Authorized for every section the caller
// may serve (advisory, assignments, code-linked timetable slots).
// ?mine=1 restricts rows to takes the caller recorded themselves, so a
// teacher's workspace rate matches what the advisory matrix attributes.
export async function getSubjectDays(query: SubjectDaysQuery) {
  const { sectionId, subjectId, mineOnly, termId, teacherId, allowed } = query;
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Section is not in your teaching load");
  }
  const [term, records] = await Promise.all([
    prisma.term.findUnique({
      where: { id: termId },
      select: { startDate: true, endDate: true },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        sectionId,
        subjectId,
        termId,
        ...(mineOnly ? { recordedBy: teacherId } : {}),
      },
      select: { studentId: true, rosterId: true, date: true, status: true, slot: true },
      orderBy: { date: "asc" },
    }),
  ]);
  return {
    sectionId,
    subjectId,
    termId,
    mineOnly,
    termStart: term?.startDate ? term.startDate.toISOString() : null,
    termEnd: term?.endDate ? term.endDate.toISOString() : null,
    records: records.map((r) => ({
      key: r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string),
      date: r.date.toISOString().slice(0, 10),
      status: r.status,
    })),
  };
}
