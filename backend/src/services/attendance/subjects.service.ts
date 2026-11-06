import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { adviserSectionsOr404 } from "../../modules/teacher/advisory.repository.js";

export interface OfferedSubjectsQuery {
  teacherId: string;
  callerRole: string;
  sectionId: string;
  termId?: string;
}

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
  // Live timetable placements also count as offered (link-code teachers often
  // have no assignment row). Union them so the sheet never looks empty.
  const scheduledSubjects =
    offerings.length > 0
      ? []
      : await prisma.sectionTimetableEntry.findMany({
          where: { sectionId, termId, status: { in: ["APPROVED", "SUBMITTED"] } },
          select: {
            subjectId: true,
            subject: { select: { id: true, name: true, code: true, gradeLevel: true } },
          },
          distinct: ["subjectId"],
          orderBy: { subject: { name: "asc" } },
        });
  const seen = new Map<string, (typeof offerings)[number]>();
  const ownBySubject = new Map<string, (typeof offerings)[number]>();
  for (const o of offerings) {
    if (o.teacherId === teacherId && !ownBySubject.has(o.subjectId)) ownBySubject.set(o.subjectId, o);
    if (!seen.has(o.subjectId)) seen.set(o.subjectId, o);
  }
  type Row = {
    assignmentId: string;
    subjectId: string;
    code: string;
    name: string;
    gradeLevel: string;
    teacherId: string;
    teacherName: string;
    ownerTeacherId: string;
    ownerTeacherName: string;
    isMine: boolean;
    myAssignmentId: string | null;
    canMark: boolean;
    takenByOther: boolean;
  };
  const rows: Row[] = [...seen.values()].map((o) => {
    const mine = ownBySubject.get(o.subjectId) ?? null;
    const canMark =
      callerRole === "principal"
        ? false
        : callerRole === "adviser"
          ? advisoryOk
          : mine !== null || linkedSubjectIds.has(o.subjectId);
    return {
      // Prefer the caller's own assignment so the frontend never submits another teacher's id.
      assignmentId: mine?.id ?? o.id,
      subjectId: o.subject.id,
      code: o.subject.code,
      name: o.subject.name,
      gradeLevel: o.subject.gradeLevel,
      teacherId: mine?.teacherId ?? o.teacherId,
      teacherName: mine?.teacher.fullName ?? o.teacher.fullName,
      ownerTeacherId: o.teacherId,
      ownerTeacherName: o.teacher.fullName,
      isMine: mine !== null || linkedSubjectIds.has(o.subjectId),
      myAssignmentId: mine?.id ?? null,
      canMark,
      takenByOther: mine === null && !linkedSubjectIds.has(o.subjectId) && callerRole !== "adviser" && callerRole !== "principal",
    };
  });
  for (const s of scheduledSubjects) {
    if (rows.some((r) => r.subjectId === s.subjectId)) continue;
    const isMine =
      callerRole === "adviser" || callerRole === "principal" || linkedSubjectIds.has(s.subjectId);
    const canMark =
      callerRole === "principal" ? false : callerRole === "adviser" ? advisoryOk : isMine;
    rows.push({
      assignmentId: "",
      subjectId: s.subject.id,
      code: s.subject.code,
      name: s.subject.name,
      gradeLevel: s.subject.gradeLevel,
      teacherId,
      teacherName: "",
      ownerTeacherId: "",
      ownerTeacherName: "",
      isMine,
      myAssignmentId: null,
      canMark,
      takenByOther: !isMine && callerRole !== "adviser" && callerRole !== "principal",
    });
  }
  return {
    sectionId,
    termId,
    subjects: rows,
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
