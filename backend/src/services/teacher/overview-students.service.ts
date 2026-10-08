import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { sectionHeadcounts } from "../enrollment.js";
import { advisoryRoster, GRADE_LABELS } from "../../modules/teacher/teacher.repository.js";
import type { TeacherContext } from "./teacher.types.js";

export interface StudentListQuery {
  classId: string;
  advisorySectionId: string;
}

export async function getStudentList(ctx: TeacherContext, query: StudentListQuery) {
  const teacherId = ctx.userId;
  const classIdParam = query.classId;
  const advisorySectionParam = query.advisorySectionId;
  const termId = ctx.termId;
  if (!termId) {
    return {
      classes: [],
      advisorySections: [],
      class: null,
      advisorySection: null,
      students: [],
    };
  }

  const [assignments, linkedSlots, advisedSections] = await Promise.all([
    prisma.teacherSubjectAssignment.findMany({
      where: { teacherId, termId },
      select: {
        id: true,
        subjectId: true,
        sectionId: true,
        subject: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true, gradeLevel: true } },
      },
      orderBy: [{ section: { name: "asc" } }, { subject: { name: "asc" } }],
    }),
    prisma.sectionTimetableEntry.findMany({
      where: {
        termId,
        status: { in: ["APPROVED", "SUBMITTED"] },
        teacherName: { userId: teacherId },
      },
      select: {
        subjectId: true,
        sectionId: true,
        subject: { select: { name: true, code: true } },
        section: { select: { name: true, gradeLevel: true } },
      },
      orderBy: [{ section: { name: "asc" } }, { subject: { name: "asc" } }],
    }),
    prisma.section.findMany({
      where: { adviserId: teacherId },
      select: { id: true, name: true, gradeLevel: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const linkedPairs = [...new Map(
    linkedSlots.map((s) => [`${s.subjectId}|${s.sectionId}`, s]),
  ).values()];
  const handledSectionIds = Array.from(
    new Set(
      (linkedPairs.length > 0
        ? linkedPairs.map((s) => s.sectionId)
        : assignments.map((a) => a.sectionId)),
    ),
  );
  const railSectionIds = Array.from(
    new Set([...handledSectionIds, ...advisedSections.map((s) => s.id)]),
  );

  if (linkedPairs.length === 0 && assignments.length === 0 && advisedSections.length === 0) {
    return {
      classes: [],
      advisorySections: [],
      class: null,
      advisorySection: null,
      students: [],
    };
  }

  const headcountsPromise = sectionHeadcounts(railSectionIds);
  const advisedIds = new Set(advisedSections.map((s) => s.id));
  const advisoryId =
    advisorySectionParam ||
    (!classIdParam && advisedSections.length > 0 ? advisedSections[0].id : "");
  const rosterPromise = (async () => {
    if (advisoryId) {
      if (!advisedIds.has(advisoryId)) {
        throw new AppError(404, "SECTION_NOT_FOUND", "Advisory section not found");
      }
      return {
        kind: "advisory" as const,
        students: await advisoryRoster(termId, advisoryId),
      };
    }
    const resolvePair = (classId: string): { subjectId: string; sectionId: string } | null => {
      const sep = classId.indexOf("|");
      if (sep >= 0) {
        return { subjectId: classId.slice(0, sep), sectionId: classId.slice(sep + 1) };
      }
      const match = assignments.find((a) => a.id === classId);
      return match ? { subjectId: match.subjectId, sectionId: match.sectionId } : null;
    };

    const activeId =
      classIdParam ||
      (linkedPairs.length > 0
        ? `${linkedPairs[0].subjectId}|${linkedPairs[0].sectionId}`
        : (assignments[0]?.id ?? ""));
    const pair = resolvePair(activeId);
    const owns =
      !!pair &&
      (assignments.some(
        (a) => a.subjectId === pair.subjectId && a.sectionId === pair.sectionId,
      ) ||
        linkedPairs.some(
          (s) => s.subjectId === pair.subjectId && s.sectionId === pair.sectionId,
        ));
    if (!pair || !owns) {
      throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
    }
    const [subject, section, profiles, rosterEntries] = await Promise.all([
      prisma.subject.findUnique({
        where: { id: pair.subjectId },
        select: { id: true, name: true, code: true },
      }),
      prisma.section.findUnique({
        where: { id: pair.sectionId },
        select: { id: true, name: true, gradeLevel: true },
      }),
      prisma.studentProfile.findMany({
        where: { sectionId: pair.sectionId },
        select: {
          userId: true,
          lrn: true,
          user: { select: { fullName: true } },
        },
        orderBy: { user: { fullName: "asc" } },
      }),
      prisma.studentRoster.findMany({
        where: { sectionId: pair.sectionId },
        select: { id: true, lrn: true, fullName: true },
        orderBy: { fullName: "asc" },
      }),
    ]);
    return {
      kind: "subject" as const,
      subjectId: pair.subjectId,
      sectionId: pair.sectionId,
      classId: activeId,
      subject,
      section,
      profiles,
      rosterEntries,
    };
  })();
  const [headcounts, roster] = await Promise.all([headcountsPromise, rosterPromise]);

  const classes = (linkedPairs.length > 0
    ? linkedPairs.map((s) => ({
        id: `${s.subjectId}|${s.sectionId}`,
        subject: s.subject.name,
        code: s.subject.code,
        gradeLevel: GRADE_LABELS[s.section.gradeLevel] ?? s.section.gradeLevel,
        section: s.section.name,
        studentCount: headcounts.get(s.sectionId) ?? 0,
      }))
    : assignments.map((a) => ({
        id: a.id,
        subject: a.subject.name,
        code: a.subject.code,
        gradeLevel: GRADE_LABELS[a.section.gradeLevel] ?? a.section.gradeLevel,
        section: a.section.name,
        studentCount: headcounts.get(a.sectionId) ?? 0,
      })));
  const advisorySections = advisedSections.map((s) => ({
    id: s.id,
    name: s.name,
    gradeLevel: GRADE_LABELS[s.gradeLevel] ?? s.gradeLevel,
    studentCount: headcounts.get(s.id) ?? 0,
  }));
  if (classes.length === 0 && advisorySections.length === 0) {
    return {
      classes,
      advisorySections,
      class: null,
      advisorySection: null,
      students: [],
    };
  }

  if (roster.kind === "advisory") {
    return {
      classes,
      advisorySections,
      class: null,
      advisorySection: advisorySections.find((s) => s.id === advisoryId) ?? null,
      students: roster.students,
    };
  }

  const { subject, section, profiles, rosterEntries, subjectId, sectionId, classId } = roster;
  if (!subject || !section) {
    throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
  }

  const registeredLrns = new Set(profiles.map((p) => p.lrn));
  const rosterOnly = rosterEntries.filter((r) => !registeredLrns.has(r.lrn));
  const profileIds = profiles.map((p) => p.userId);
  const rosterIds = rosterOnly.map((r) => r.id);

  const [profileFinals, rosterFinals, attendance, entries, term] = await Promise.all([
    profileIds.length > 0
      ? prisma.finalGrade.findMany({
          where: { subjectId, termId, studentId: { in: profileIds } },
          select: {
            studentId: true,
            computedAverage: true,
            transmutedGrade: true,
          },
        })
      : Promise.resolve([] as { studentId: string | null; computedAverage: number | null; transmutedGrade: number | null }[]),
    rosterIds.length > 0
      ? prisma.finalGrade.findMany({
          where: { subjectId, termId, rosterId: { in: rosterIds } },
          select: {
            rosterId: true,
            computedAverage: true,
            transmutedGrade: true,
          },
        })
      : Promise.resolve([] as { rosterId: string | null; computedAverage: number | null; transmutedGrade: number | null }[]),
    prisma.attendanceRecord.findMany({
      where: { termId, sectionId, subjectId },
      select: { studentId: true, rosterId: true, status: true, date: true },
    }),

    prisma.sectionTimetableEntry.findMany({
      where: {
        sectionId,
        subjectId,
        termId,
        status: { in: ["APPROVED", "SUBMITTED"] },
      },
      select: { day: true },
    }),
    prisma.term.findUnique({
      where: { id: termId },
      select: { startDate: true, endDate: true },
    }),
  ]);

  const finalByKey = new Map<
    string,
    { computedAverage: number | null; transmutedGrade: number | null }
  >();
  for (const f of profileFinals) {
    if (f.studentId) {
      finalByKey.set(f.studentId, {
        computedAverage: f.computedAverage,
        transmutedGrade: f.transmutedGrade,
      });
    }
  }
  for (const f of rosterFinals) {
    if (f.rosterId) {
      finalByKey.set(`roster:${f.rosterId}`, {
        computedAverage: f.computedAverage,
        transmutedGrade: f.transmutedGrade,
      });
    }
  }

  const meetupDays = [...new Set(entries.map((e) => e.day))];
  const elapsed = new Set<string>();
  const startStr = term?.startDate?.toISOString().slice(0, 10) ?? null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const termEndStr = term?.endDate?.toISOString().slice(0, 10) ?? null;
  const endStr = termEndStr && termEndStr < todayStr ? termEndStr : todayStr;
  if (startStr && startStr <= endStr) {
    for (
      let d = new Date(`${startStr}T00:00:00Z`);
      d.toISOString().slice(0, 10) <= endStr;
      d = new Date(d.getTime() + 86_400_000)
    ) {
      const dow = d.getUTCDay();
      const day = dow === 0 ? 7 : dow;
      if (meetupDays.includes(day)) elapsed.add(d.toISOString().slice(0, 10));
    }
  }
  const DAY_RANK: Record<string, number> = { present: 0, excused: 1, late: 2, absent: 3 };
  const worstByStudent = new Map<string, Map<string, number>>();
  for (const r of attendance) {
    const key = r.studentId ?? (r.rosterId ? `roster:${r.rosterId}` : null);
    if (!key) continue;
    const dayKey = r.date.toISOString().slice(0, 10);
    if (!elapsed.has(dayKey)) continue;
    let perDay = worstByStudent.get(key);
    if (!perDay) {
      perDay = new Map<string, number>();
      worstByStudent.set(key, perDay);
    }
    const rank = DAY_RANK[r.status] ?? 3;
    perDay.set(dayKey, Math.max(perDay.get(dayKey) ?? -1, rank));
  }
  const presentMeetupsOf = (studentKey: string): number => {
    let n = 0;
    for (const rank of worstByStudent.get(studentKey)?.values() ?? []) {
      if (rank === 0) n += 1;
    }
    return n;
  };

  const students = [
    ...profiles.map((p) => ({
      studentId: p.userId,
      name: p.user.fullName,
      lrn: p.lrn,
      hasAccount: true as const,
    })),
    ...rosterOnly.map((r) => ({
      studentId: `roster:${r.id}`,
      name: r.fullName,
      lrn: r.lrn,
      hasAccount: false as const,
    })),
  ]
    .map((s) => {
      const present = presentMeetupsOf(s.studentId);
      const final = finalByKey.get(s.studentId) ?? null;
      return {
        ...s,
        attendancePresent: present,
        attendanceTotal: elapsed.size,
        attendancePercentage:
          elapsed.size > 0 ? Math.round((present / elapsed.size) * 1000) / 10 : null,
        computedAverage: final?.computedAverage ?? null,
        academicGrade: final?.transmutedGrade ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    classes,
    advisorySections,
    class: {
      id: classId,
      subjectId,
      subjectName: subject.name,
      subjectCode: subject.code,
      sectionId,
      sectionName: section.name,
      gradeLevel: GRADE_LABELS[section.gradeLevel] ?? section.gradeLevel,
    },
    advisorySection: null,
    students,
  };
}
