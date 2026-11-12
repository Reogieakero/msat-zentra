import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import {
  archivedAdvisoryLearnerIds,
  excludeArchivedProfiles,
  excludeArchivedRosters,
} from "../../lib/learnerVisibility.js";
import {
  buildDayAxis,
  countSchoolDays,
  isWeekendKey,
  studentDayOutcomes,
  sectionStrictDays,
  buildOfferedMap,
  termHasStarted,
  type AttendanceStatus,
} from "../attendance.js";
import {
  GRADE_NUMERIC,
} from "../../modules/attendance/attendance.repository.js";
import { admExemptStudentIds } from "../adm/attendancePolicy.js";

export interface SectionScope {
  termId?: string;
  schoolYearId: string | null;
}

export async function listSections(schoolYearId: string | null) {
  const sections = await prisma.section.findMany({
    where: schoolYearId ? { schoolYearId } : {},
    select: { id: true, name: true, gradeLevel: true },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
  });
  return {
    sections: sections.map((s) => ({
      id: s.id,
      section: `Grade ${s.name}`,
      grade: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
    })),
  };
}

export interface SectionStudentsQuery {
  sectionId: string;
  session: "AM" | "PM";
  termId?: string;
  startDate?: Date | null;
  endDate?: Date | null;
}

export async function getSectionStudents(query: SectionStudentsQuery) {
  const { sectionId, session, termId, startDate, endDate } = query;
  if (!termId) {
    return { sectionId, students: [] };
  }

  const totalSchoolDays = countSchoolDays(buildDayAxis(startDate ?? null, endDate ?? null));
  // Signed ADM cases: the sheet shows them as an exempt group, not absent.
  const admExempt = await admExemptStudentIds(termId);

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { id: true, name: true, gradeLevel: true },
  });
  if (!section) {
    throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
  }

  const subjectTakes = await prisma.attendanceRecord.findMany({
    where: { sectionId, termId, NOT: { subjectId: null } },
    select: {
      studentId: true,
      rosterId: true,
      subjectId: true,
      date: true,
      status: true,
    },
  });

  if (subjectTakes.length === 0) {

    const archivedLearners = await archivedAdvisoryLearnerIds();
    const [students, rosterEntries] = await Promise.all([
      prisma.studentProfile.findMany({
        where: { sectionId, ...excludeArchivedProfiles(archivedLearners) },
        select: {
          userId: true,
          lrn: true,
          mascot: true,
          user: { select: { fullName: true } },
          attendanceRecords: {
            where: { termId, session },
            select: { status: true },
          },
        },
        orderBy: { user: { fullName: "asc" } },
      }),

      prisma.studentRoster.findMany({
        where: { sectionId, ...excludeArchivedRosters(archivedLearners) },
        select: {
          id: true,
          lrn: true,
          fullName: true,
          mascot: true,
          attendanceRecords: {
            where: { termId, session },
            select: { status: true },
          },
        },
        orderBy: { fullName: "asc" },
      }),
    ]);
    const registeredLrns = new Set(students.map((st) => st.lrn));

    const toRow = (
      id: string,
      lrn: string,
      name: string,
      mascot: string | null,
      records: { status: string }[],
      hasAccount: boolean,
    ) => {
      const counts = { present: 0, late: 0, absent: 0, excused: 0 };
      for (const r of records) {
        if (r.status === "present") counts.present++;
        else if (r.status === "late") counts.late++;
        else if (r.status === "absent") counts.absent++;
        else if (r.status === "excused") counts.excused++;
      }
      const rate =
        totalSchoolDays > 0
          ? Math.round((counts.present / totalSchoolDays) * 1000) / 10
          : 0;
      return {
        id,
        lrn,
        name,
        mascot,
        present: counts.present,
        late: counts.late,
        absent: counts.absent,
        excused: counts.excused,
        rate,
        hasAccount,
        admExempt: admExempt.has(id),
      };
    };

    const result = [
      ...students.map((st) =>
        toRow(st.userId, st.lrn, st.user.fullName, st.mascot ?? null, st.attendanceRecords, true),
      ),
      ...rosterEntries
        .filter((r) => !registeredLrns.has(r.lrn))
        .map((r) => toRow(`roster:${r.id}`, r.lrn, r.fullName, r.mascot ?? null, r.attendanceRecords, false)),
    ];

    return {
      sectionId,
      section: `Grade ${section.name}`,
      gradeLevel: GRADE_NUMERIC[section.gradeLevel] ?? section.gradeLevel,
      schoolDays: totalSchoolDays,
      students: result,
    };
  }

  const [entries, students, rosterEntries] = await Promise.all([
    prisma.sectionTimetableEntry.findMany({
      where: {
        sectionId,
        termId,
        status: { in: ["APPROVED", "SUBMITTED"] },
      },
      select: { sectionId: true, subjectId: true, day: true },
    }),
    prisma.studentProfile.findMany({
      where: { sectionId },
      select: {
        userId: true,
        lrn: true,
        mascot: true,
        user: { select: { fullName: true } },
      },
      orderBy: { user: { fullName: "asc" } },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId },
      select: { id: true, lrn: true, fullName: true, mascot: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const strict = sectionStrictDays(
    subjectTakes.map((r) => ({
      sectionId,
      studentKey: r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string),
      subjectId: r.subjectId as string,
      date: r.date,
      status: r.status as AttendanceStatus,
    })),
    buildOfferedMap(entries)
  );

  type Enrolled = {
    key: string;
    id: string;
    lrn: string;
    name: string;
    mascot: string | null;
    hasAccount: boolean;
  };
  const enrolled: Enrolled[] = [];
  const seenLrn = new Set<string>();
  for (const st of students) {
    seenLrn.add(st.lrn);
    enrolled.push({
      key: st.userId,
      id: st.userId,
      lrn: st.lrn,
      name: st.user.fullName,
      mascot: st.mascot ?? null,
      hasAccount: true,
    });
  }
  for (const r of rosterEntries) {
    if (seenLrn.has(r.lrn)) continue;
    enrolled.push({
      key: `roster:${r.id}`,
      id: `roster:${r.id}`,
      lrn: r.lrn,
      name: r.fullName,
      mascot: r.mascot ?? null,
      hasAccount: false,
    });
  }

  const outcomeKeys = buildDayAxis(startDate ?? null, endDate ?? null).filter(
    (k) => !isWeekendKey(k)
  );
  const outcomes = studentDayOutcomes(
    strict.get(sectionId),
    enrolled.map((e) => e.key),
    outcomeKeys
  );
  const days = outcomeKeys.length;

  const result = enrolled.map((e) => {
    const o = outcomes.get(e.key) ?? { present: 0, late: 0, excused: 0, absent: 0 };
    const rate =
      days > 0 ? Math.round((o.present / days) * 1000) / 10 : 0;
    return {
      id: e.id,
      lrn: e.lrn,
      name: e.name,
      mascot: e.mascot,
      present: o.present,
      late: o.late,
      absent: o.absent,
      excused: o.excused,
      rate,
      hasAccount: e.hasAccount,
      admExempt: admExempt.has(e.id),
    };
  });

  return {
    sectionId,
    section: `Grade ${section.name}`,
    gradeLevel: GRADE_NUMERIC[section.gradeLevel] ?? section.gradeLevel,
    schoolDays: days,
    students: result,
  };
}

export async function getSectionRoster(
  sectionId: string,
  termId: string,
  allowed: boolean,
) {
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Section is not in your teaching load");
  }
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { id: true, name: true },
  });
  if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
  const archivedLearners = await archivedAdvisoryLearnerIds();
  const [profiles, rosterRows] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId, ...excludeArchivedProfiles(archivedLearners) },
      select: {
        userId: true,
        lrn: true,
        mascot: true,
        user: { select: { fullName: true } },
        attendanceRecords: { where: { termId }, select: { status: true } },
      },
      orderBy: { user: { fullName: "asc" } },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId, ...excludeArchivedRosters(archivedLearners) },
      select: { id: true, lrn: true, fullName: true, mascot: true },
      orderBy: { fullName: "asc" },
    }),
  ]);
  const registeredLrns = new Set(profiles.map((p) => p.lrn));
  const admExempt = await admExemptStudentIds(termId);
  const students = [
    ...profiles.map((p) => {
      const present = p.attendanceRecords.filter((r) => r.status === "present").length;
      const total = p.attendanceRecords.length;
      return {
        studentId: p.userId,
        name: p.user.fullName,
        lrn: p.lrn,
        mascot: p.mascot ?? null,
        attendanceRate: total === 0 ? 1 : present / total,
        admExempt: admExempt.has(p.userId),
      };
    }),
    ...rosterRows
      .filter((r) => !registeredLrns.has(r.lrn))
      .map((r) => ({ studentId: `roster:${r.id}`, name: r.fullName, lrn: r.lrn, mascot: r.mascot ?? null, attendanceRate: 1, admExempt: false })),
  ];

  const surnameOf = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return (parts[parts.length - 1] ?? "").toLowerCase();
  };
  students.sort(
    (a, b) => surnameOf(a.name).localeCompare(surnameOf(b.name)) || a.name.localeCompare(b.name),
  );

  if (rosterRows.length > 0) {
    const rosterAtt = await prisma.attendanceRecord.findMany({
      where: { rosterId: { in: rosterRows.map((r) => r.id) }, termId },
      select: { rosterId: true, status: true },
    });
    const byRoster = new Map<string, { present: number; total: number }>();
    for (const a of rosterAtt) {
      const cell = byRoster.get(a.rosterId as string) ?? { present: 0, total: 0 };
      cell.total += 1;
      if (a.status === "present") cell.present += 1;
      byRoster.set(a.rosterId as string, cell);
    }
    for (const s of students) {
      if (!s.studentId.startsWith("roster:")) continue;
      const cell = byRoster.get(s.studentId.slice("roster:".length));
      if (cell && cell.total > 0) s.attendanceRate = cell.present / cell.total;
    }
  }
  return { sectionId: section.id, sectionName: section.name, termId, students };
}

export async function getSectionSummary(
  sectionId: string,
  termId: string,
  allowed: boolean,
) {
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Section is not in your teaching load");
  }
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { id: true, name: true },
  });
  if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
  const archivedLearners = await archivedAdvisoryLearnerIds();
  const [profiles, rosterRows, records] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId, ...excludeArchivedProfiles(archivedLearners) },
      select: { userId: true, lrn: true, mascot: true, user: { select: { fullName: true } } },
      orderBy: { user: { fullName: "asc" } },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId, ...excludeArchivedRosters(archivedLearners) },
      select: { id: true, lrn: true, fullName: true, mascot: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.attendanceRecord.findMany({
      where: { sectionId, termId, NOT: { subjectId: null } },
      select: { studentId: true, rosterId: true, subjectId: true, status: true },
    }),
  ]);
  const registeredLrns = new Set(profiles.map((p) => p.lrn));
  type Agg = { present: number; late: number; absent: number; excused: number };
  const byKey = new Map<string, Agg>();
  const bump = (key: string, status: string) => {
    const cell = byKey.get(key) ?? { present: 0, late: 0, absent: 0, excused: 0 };
    if (status === "present") cell.present += 1;
    else if (status === "late") cell.late += 1;
    else if (status === "absent") cell.absent += 1;
    else if (status === "excused") cell.excused += 1;
    byKey.set(key, cell);
  };
  for (const r of records) {
    bump(r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string), r.status);
  }
  const students = [
    ...profiles.map((p) => {
      const agg = byKey.get(p.userId) ?? { present: 0, late: 0, absent: 0, excused: 0 };
      const total = agg.present + agg.late + agg.absent + agg.excused;
      return {
        studentId: p.userId,
        name: p.user.fullName,
        lrn: p.lrn,
        mascot: p.mascot ?? null,
        ...agg,
        total,
        rate: total === 0 ? 1 : agg.present / total,
      };
    }),
    ...rosterRows
      .filter((r) => !registeredLrns.has(r.lrn))
      .map((r) => {
        const agg = byKey.get(`roster:${r.id}`) ?? { present: 0, late: 0, absent: 0, excused: 0 };
        const total = agg.present + agg.late + agg.absent + agg.excused;
        return {
          studentId: `roster:${r.id}`,
          name: r.fullName,
          lrn: r.lrn,
          mascot: r.mascot ?? null,
          ...agg,
          total,
          rate: total === 0 ? 1 : agg.present / total,
        };
      }),
  ];
  const surnameOf = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return (parts[parts.length - 1] ?? "").toLowerCase();
  };
  students.sort(
    (a, b) => surnameOf(a.name).localeCompare(surnameOf(b.name)) || a.name.localeCompare(b.name),
  );
  return { sectionId: section.id, sectionName: section.name, termId, students };
}

export interface MatrixQuery {
  sectionId: string;
  termId: string;
  allowed: boolean;
}

/**
 * Per-subject meetup plan for a section/term — the single source of truth for
 * the subject-attendance denominators used by the attendance desk and the
 * advisee insight card. A meetup is one TIMETABLE SLOT: a subject that meets
 * three periods on a Tuesday counts three meetups that day. Occurrences are
 * expanded from the published timetable for every date from the term start to
 * today (or the term end); a subject with no scheduling falls back to the
 * (date, slot) sheets actually recorded. Callers slice these counts per learner
 * (transferees count only meetups AFTER their enlistment day).
 */
export interface SubjectMeetupPlan {
  /** False for a term that has not started yet — callers should report no marks. */
  termStarted: boolean;
  subjects: Map<string, { id: string; name: string; code: string }>;
  /** Scheduled meetups per subject per date (double periods count separately). */
  scheduledCountBySubjectDate: Map<string, Map<string, number>>;
  /** Recorded meetups per subject per date (distinct slots) — fallback only. */
  recordedCountBySubjectDate: Map<string, Map<string, number>>;
}

export async function loadSubjectMeetups(
  sectionId: string,
  termId: string,
): Promise<SubjectMeetupPlan> {
  const [timetabled, offered, sheets, term] = await Promise.all([
    prisma.sectionTimetableEntry.findMany({
      where: { sectionId, termId, status: { in: ["APPROVED", "SUBMITTED"] } },
      select: {
        subjectId: true,
        day: true,
        period: true,
        subject: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.teacherSubjectAssignment.findMany({
      where: { sectionId, termId },
      select: { subject: { select: { id: true, name: true, code: true } } },
      distinct: ["subjectId"],
    }),
    prisma.attendanceRecord.findMany({
      where: { sectionId, termId, NOT: { subjectId: null } },
      select: { subjectId: true, date: true, slot: true, subject: { select: { id: true, name: true, code: true } } },
    }),
    prisma.term.findUnique({
      where: { id: termId },
      select: { startDate: true, endDate: true },
    }),
  ]);

  const subjects = new Map<string, { id: string; name: string; code: string }>();
  for (const o of offered) subjects.set(o.subject.id, o.subject);
  for (const t of timetabled) subjects.set(t.subject.id, t.subject);
  for (const s of sheets) if (s.subject) subjects.set(s.subject.id, s.subject);

  // Subject → weekday → distinct periods. Every period is its own meetup, so a
  // subject timetabled twice on Monday contributes two meetups per Monday.
  const periodsBySubjectDay = new Map<string, Map<number, Set<number>>>();
  for (const t of timetabled) {
    let byDay = periodsBySubjectDay.get(t.subjectId);
    if (!byDay) {
      byDay = new Map();
      periodsBySubjectDay.set(t.subjectId, byDay);
    }
    let periods = byDay.get(t.day);
    if (!periods) {
      periods = new Set();
      byDay.set(t.day, periods);
    }
    periods.add(t.period);
  }

  const recordedSlotsBySubjectDate = new Map<string, Map<string, Set<number>>>();
  for (const s of sheets) {
    if (!s.subjectId) continue;
    let byDate = recordedSlotsBySubjectDate.get(s.subjectId);
    if (!byDate) {
      byDate = new Map();
      recordedSlotsBySubjectDate.set(s.subjectId, byDate);
    }
    const key = s.date.toISOString().slice(0, 10);
    let slots = byDate.get(key);
    if (!slots) {
      slots = new Set();
      byDate.set(key, slots);
    }
    slots.add(s.slot);
  }
  const recordedCountBySubjectDate = new Map<string, Map<string, number>>();
  for (const [sid, byDate] of recordedSlotsBySubjectDate) {
    recordedCountBySubjectDate.set(
      sid,
      new Map([...byDate].map(([date, slots]) => [date, slots.size])),
    );
  }

  // A term that has not started yet is outside its scope period: do not derive
  // rates from seeded/staged rows. `null` renders as "No marks yet" in the UI.
  const termStarted = termHasStarted(term?.startDate);
  const startStr = term?.startDate?.toISOString().slice(0, 10) ?? null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const endStr = (() => {
    if (!term?.endDate) return todayStr;
    const termEnd = term.endDate.toISOString().slice(0, 10);
    return termEnd < todayStr ? termEnd : todayStr;
  })();
  const scheduledCountBySubjectDate = new Map<string, Map<string, number>>();
  if (startStr && startStr <= endStr) {
    for (const sid of subjects.keys()) {
      const byDay = periodsBySubjectDay.get(sid);
      const byDate = new Map<string, number>();
      for (
        let d = new Date(`${startStr}T00:00:00Z`);
        d.toISOString().slice(0, 10) <= endStr;
        d = new Date(d.getTime() + 86_400_000)
      ) {
        const dow = d.getUTCDay();
        const day = dow === 0 ? 7 : dow;
        // No timetable for this subject → assume one weekday meetup, matching
        // the pre-slot behaviour (recorded sheets remain the better fallback).
        const count = byDay ? (byDay.get(day)?.size ?? 0) : day <= 5 ? 1 : 0;
        if (count > 0) byDate.set(d.toISOString().slice(0, 10), count);
      }
      scheduledCountBySubjectDate.set(sid, byDate);
    }
  }

  return { termStarted, subjects, scheduledCountBySubjectDate, recordedCountBySubjectDate };
}

export async function getSectionSubjectMatrix(query: MatrixQuery) {
  const { sectionId, termId, allowed } = query;
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Section is not in your teaching load");
  }
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { id: true, name: true },
  });
  if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
  const archivedLearners = await archivedAdvisoryLearnerIds();
  const [profiles, rosterRows, records, plan] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId, ...excludeArchivedProfiles(archivedLearners) },
      select: { userId: true, lrn: true, mascot: true, user: { select: { fullName: true } } },
      orderBy: { user: { fullName: "asc" } },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId, ...excludeArchivedRosters(archivedLearners) },
      select: {
        id: true,
        lrn: true,
        fullName: true,
        mascot: true,
        learnerType: true,
        createdAt: true,
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.attendanceRecord.findMany({
      where: { sectionId, termId, NOT: { subjectId: null } },
      select: { studentId: true, rosterId: true, subjectId: true, status: true, date: true, slot: true },
    }),
    loadSubjectMeetups(sectionId, termId),
  ]);
  const registeredLrns = new Set(profiles.map((p) => p.lrn));
  const subjects = plan.subjects;
  const { termStarted, scheduledCountBySubjectDate, recordedCountBySubjectDate } = plan;
  const presentSlotsByStudentSubjectDate = new Map<string, Map<string, Set<number>>>();
  for (const r of records) {
    if (r.status !== "present") continue;
    const subjectId = r.subjectId as string;
    const dateStr = r.date.toISOString().slice(0, 10);
    const studentKey = r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string);
    const key = `${studentKey}|${subjectId}`;
    let byDate = presentSlotsByStudentSubjectDate.get(key);
    if (!byDate) {
      byDate = new Map();
      presentSlotsByStudentSubjectDate.set(key, byDate);
    }
    let slots = byDate.get(dateStr);
    if (!slots) {
      slots = new Set();
      byDate.set(dateStr, slots);
    }
    slots.add(r.slot);
  }
  const rosterOnly = rosterRows.filter((r) => !registeredLrns.has(r.lrn));
  // Transferees are rated from the day AFTER their enlistment date, not from
  // the term start — the same window the risk engine, the auto-absent sweep
  // and the advisory-list insight use. Without this a learner enlisted today
  // would read every earlier meetup as an absence.
  const transfereeStart = new Map<string, string>();
  for (const r of rosterOnly) {
    if (r.learnerType === "transferee") {
      transfereeStart.set(`roster:${r.id}`, r.createdAt.toISOString().slice(0, 10));
    }
  }
  interface SubjectProgress {
    /** Present rate inside this learner's own meetup window. */
    rate: number | null;
    /** Elapsed meetups in that window (transferees count from day after enlistment). */
    meetups: number;
    /** Present meetups out of `meetups`. */
    present: number;
  }
  const progressOf = (studentKey: string, subjectId: string): SubjectProgress => {
    if (!termStarted) return { rate: null, meetups: 0, present: 0 };
    const scheduled = scheduledCountBySubjectDate.get(subjectId);
    const counts =
      scheduled && scheduled.size > 0
        ? scheduled
        : recordedCountBySubjectDate.get(subjectId);
    if (!counts || counts.size === 0) return { rate: null, meetups: 0, present: 0 };
    const presentByDate = presentSlotsByStudentSubjectDate.get(
      `${studentKey}|${subjectId}`,
    );
    // A transferee's window opens the day AFTER enlistment; everyone else is
    // rated from the term start.
    const enlistStr = transfereeStart.get(studentKey);
    let meetups = 0;
    let attended = 0;
    for (const [date, count] of counts) {
      if (enlistStr && date <= enlistStr) continue;
      meetups += count;
      const presentSlots = presentByDate?.get(date)?.size ?? 0;
      attended += Math.min(count, presentSlots);
    }
    // No meetup has happened since they joined yet → no attendance signal
    // (never a fabricated 0%).
    if (meetups === 0) return { rate: null, meetups: 0, present: 0 };
    return { rate: attended / meetups, meetups, present: attended };
  };
  const students = [
    ...profiles.map((p) => ({
      studentId: p.userId,
      name: p.user.fullName,
      lrn: p.lrn,
      mascot: p.mascot ?? null,
      learnerType: "regular" as const,
    })),
    ...rosterOnly.map((r) => ({
      studentId: `roster:${r.id}`,
      name: r.fullName,
      lrn: r.lrn,
      mascot: r.mascot ?? null,
      learnerType: r.learnerType,
    })),
  ];
  const surnameOf = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return (parts[parts.length - 1] ?? "").toLowerCase();
  };
  students.sort(
    (a, b) => surnameOf(a.name).localeCompare(surnameOf(b.name)) || a.name.localeCompare(b.name),
  );
  return {
    sectionId: section.id,
    sectionName: section.name,
    termId,
    subjects: [...subjects.values()].sort((a, b) => a.name.localeCompare(b.name)),
    students: students.map((s) => {
      const progress = Object.fromEntries(
        [...subjects.keys()].map((sid) => [sid, progressOf(s.studentId, sid)]),
      ) as Record<string, SubjectProgress>;
      return {
        studentId: s.studentId,
        name: s.name,
        lrn: s.lrn,
        mascot: s.mascot,
        learnerType: s.learnerType,
        rates: Object.fromEntries(
          Object.entries(progress).map(([sid, p]) => [sid, p.rate]),
        ) as Record<string, number | null>,
        meetups: Object.fromEntries(
          Object.entries(progress).map(([sid, p]) => [sid, p.meetups]),
        ) as Record<string, number>,
        presentMeetups: Object.fromEntries(
          Object.entries(progress).map(([sid, p]) => [sid, p.present]),
        ) as Record<string, number>,
      };
    }),
  };
}
