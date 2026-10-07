import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import {
  buildDayAxis,
  countSchoolDays,
  isWeekendKey,
  studentDayOutcomes,
  sectionStrictDays,
  buildOfferedMap,
  type AttendanceStatus,
} from "../attendance.js";
import {
  GRADE_NUMERIC,
  schoolYearClause,
} from "../../modules/attendance/attendance.repository.js";

export interface SectionScope {
  termId?: string;
  schoolYearId: string | null;
}

// Sections for the session's active school year — id, name, and grade level.
// Powers the "Grades & sections" navigation card on the heatmap pages.
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
}

// Students in a section with their attendance for the session's active term.
// Strict per-day basis: present = days present in EVERY offered subject that
// weekday; late/excused/absent are day outcomes on the same basis, so the
// four counts always sum to school days. `session` is accepted but ignored on
// the strict path; it only applies to the legacy fallback when the section
// holds zero subject-era rows for the term.
export async function getSectionStudents(query: SectionStudentsQuery) {
  const { sectionId, session, termId, startDate } = query;
  if (!termId) {
    return { sectionId, students: [] };
  }

  // Total ongoing school days: weekdays (Mon–Fri) from the term start date
  // through today. Same engine as the section stats so the denominators
  // (schoolDays) never disagree between the overview and the roster.
  const totalSchoolDays = countSchoolDays(buildDayAxis(startDate ?? null));

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
    // Frozen legacy basis (no subject-era rows) — original logic unchanged.
    const [students, rosterEntries] = await Promise.all([
      prisma.studentProfile.findMany({
        where: { sectionId },
        select: {
          userId: true,
          lrn: true,
          user: { select: { fullName: true } },
          attendanceRecords: {
            where: { termId, session },
            select: { status: true },
          },
        },
        orderBy: { user: { fullName: "asc" } },
      }),
      // Enlisted students without accounts — zero-record rows included.
      prisma.studentRoster.findMany({
        where: { sectionId },
        select: {
          id: true,
          lrn: true,
          fullName: true,
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
        present: counts.present,
        late: counts.late,
        absent: counts.absent,
        excused: counts.excused,
        rate,
        hasAccount,
      };
    };

    const result = [
      ...students.map((st) =>
        toRow(st.userId, st.lrn, st.user.fullName, st.attendanceRecords, true),
      ),
      ...rosterEntries
        .filter((r) => !registeredLrns.has(r.lrn))
        .map((r) => toRow(`roster:${r.id}`, r.lrn, r.fullName, r.attendanceRecords, false)),
    ];

    return {
      sectionId,
      section: `Grade ${section.name}`,
      gradeLevel: GRADE_NUMERIC[section.gradeLevel] ?? section.gradeLevel,
      schoolDays: totalSchoolDays,
      students: result,
    };
  }

  // Strict path: day outcomes per enrolled student (LRN-deduped).
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
        user: { select: { fullName: true } },
      },
      orderBy: { user: { fullName: "asc" } },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId },
      select: { id: true, lrn: true, fullName: true },
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
      hasAccount: true,
    });
  }
  for (const r of rosterEntries) {
    if (seenLrn.has(r.lrn)) continue; // registered profile wins
    enrolled.push({
      key: `roster:${r.id}`,
      id: `roster:${r.id}`,
      lrn: r.lrn,
      name: r.fullName,
      hasAccount: false,
    });
  }

  // Weekday axis only — weekend days never classify anyone absent.
  const outcomeKeys = buildDayAxis(startDate ?? null).filter(
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
      present: o.present,
      late: o.late,
      absent: o.absent,
      excused: o.excused,
      rate,
      hasAccount: e.hasAccount,
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
  const [profiles, rosterRows] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId },
      select: {
        userId: true,
        lrn: true,
        user: { select: { fullName: true } },
        attendanceRecords: { where: { termId }, select: { status: true } },
      },
      orderBy: { user: { fullName: "asc" } },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId },
      select: { id: true, lrn: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);
  const registeredLrns = new Set(profiles.map((p) => p.lrn));
  const students = [
    ...profiles.map((p) => {
      const present = p.attendanceRecords.filter((r) => r.status === "present").length;
      const total = p.attendanceRecords.length;
      return {
        studentId: p.userId,
        name: p.user.fullName,
        lrn: p.lrn,
        attendanceRate: total === 0 ? 1 : present / total,
      };
    }),
    ...rosterRows
      .filter((r) => !registeredLrns.has(r.lrn))
      .map((r) => ({ studentId: `roster:${r.id}`, name: r.fullName, lrn: r.lrn, attendanceRate: 1 })),
  ];
  // Alphabetical by surname (last token), tie-broken by full name.
  const surnameOf = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return (parts[parts.length - 1] ?? "").toLowerCase();
  };
  students.sort(
    (a, b) => surnameOf(a.name).localeCompare(surnameOf(b.name)) || a.name.localeCompare(b.name),
  );
  // Roster-only attendance rates need their own rows (profiles came with
  // theirs above).
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

// Per-student attendance summary for one section (active term, all
// subjects): present/late/absent/excused counts plus the present rate.
// Authorized for every section the caller may serve — feeds the advisory
// attendance table.
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
  const [profiles, rosterRows, records] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId },
      select: { userId: true, lrn: true, user: { select: { fullName: true } } },
      orderBy: { user: { fullName: "asc" } },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId },
      select: { id: true, lrn: true, fullName: true },
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

// Per-student, per-subject present rates for one section (active term).
// Read-only matrix for advisory views: each student maps to one rate per
// subject (null when the subject has no records for them yet).
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
  const [profiles, rosterRows, records, timetabled, offered] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId },
      select: { userId: true, lrn: true, user: { select: { fullName: true } } },
      orderBy: { user: { fullName: "asc" } },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId },
      select: { id: true, lrn: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.attendanceRecord.findMany({
      where: { sectionId, termId, NOT: { subjectId: null } },
      select: { studentId: true, rosterId: true, subjectId: true, status: true, date: true, slot: true },
    }),
    prisma.sectionTimetableEntry.findMany({
      where: { sectionId, termId, status: { in: ["APPROVED", "SUBMITTED"] } },
      select: {
        subjectId: true,
        day: true,
        subject: { select: { id: true, name: true, code: true } },
        teacherName: { select: { userId: true } },
      },
    }),
    // Every subject offered in this section + term, so the matrix
    // covers the full advisory load — not just scheduled/recorded ones.
    prisma.teacherSubjectAssignment.findMany({
      where: { sectionId, termId },
      select: { subject: { select: { id: true, name: true, code: true } } },
      distinct: ["subjectId"],
    }),
  ]);
  const registeredLrns = new Set(profiles.map((p) => p.lrn));
  const subjects = new Map<string, { id: string; name: string; code: string }>();
  for (const o of offered) subjects.set(o.subject.id, o.subject);
  for (const t of timetabled) subjects.set(t.subject.id, t.subject);
  // Subjects with records but no timetable row still get a column.
  const subjectIds = await prisma.subject.findMany({
    where: { id: { in: [...new Set(records.map((r) => r.subjectId as string))] } },
    select: { id: true, name: true, code: true },
  });
  for (const s of subjectIds) {
    if (!subjects.has(s.id)) subjects.set(s.id, s);
  }
  // Rate = present ÷ elapsed meetups. Elapsed meetups come from the
  // subject's committed timetable slots (weekdays × term start → today);
  // a done meetup with no take counts as absent, so "no record" never
  // renders — only a percentage. Presents dated outside the term window
  // are ignored on both sides, keeping the rate within 0–100%.
  const meetupBySubject = new Map<string, number[]>();
  for (const t of timetabled) {
    const arr = meetupBySubject.get(t.subjectId) ?? [];
    if (!arr.includes(t.day)) arr.push(t.day);
    meetupBySubject.set(t.subjectId, arr);
  }
  const term = await prisma.term.findUnique({
    where: { id: termId },
    select: { startDate: true, endDate: true },
  });
  const startStr = term?.startDate?.toISOString().slice(0, 10) ?? null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const endStr = (() => {
    if (!term?.endDate) return todayStr;
    const termEnd = term.endDate.toISOString().slice(0, 10);
    return termEnd < todayStr ? termEnd : todayStr;
  })();
  const elapsedDatesBySubject = new Map<string, Set<string>>();
  if (startStr && startStr <= endStr) {
    for (const sid of subjects.keys()) {
      const days = meetupBySubject.get(sid) ?? [1, 2, 3, 4, 5];
      const set = new Set<string>();
      for (
        let d = new Date(`${startStr}T00:00:00Z`);
        d.toISOString().slice(0, 10) <= endStr;
        d = new Date(d.getTime() + 86_400_000)
      ) {
        const dow = d.getUTCDay();
        const day = dow === 0 ? 7 : dow;
        if (days.includes(day)) set.add(d.toISOString().slice(0, 10));
      }
      elapsedDatesBySubject.set(sid, set);
    }
  }
  const presentDatesByStudentSubject = new Map<string, Set<string>>();
  const recordedDatesBySubject = new Map<string, Set<string>>();
  for (const r of records) {
    const subjectId = r.subjectId as string;
    const dateStr = r.date.toISOString().slice(0, 10);
    // Every subject teacher's workspace takes count — the adviser
    // oversees records from all of them, not just the slot owner.
    const studentKey = r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string);
    let recorded = recordedDatesBySubject.get(subjectId);
    if (!recorded) {
      recorded = new Set();
      recordedDatesBySubject.set(subjectId, recorded);
    }
    recorded.add(dateStr);
    if (r.status === "present") {
      const key = `${studentKey}|${subjectId}`;
      let present = presentDatesByStudentSubject.get(key);
      if (!present) {
        present = new Set();
        presentDatesByStudentSubject.set(key, present);
      }
      present.add(dateStr);
    }
  }
  const rateOf = (studentKey: string, subjectId: string) => {
    const elapsed = elapsedDatesBySubject.get(subjectId);
    const present = presentDatesByStudentSubject.get(`${studentKey}|${subjectId}`);
    if (elapsed && elapsed.size > 0) {
      let n = 0;
      for (const d of present ?? []) if (elapsed.has(d)) n += 1;
      return n / elapsed.size;
    }
    // Term hasn't started — fall back to recorded sessions so a number
    // still renders instead of "no record".
    const recorded = recordedDatesBySubject.get(subjectId)?.size ?? 0;
    if (recorded === 0) return 0;
    let n = 0;
    for (const d of present ?? []) {
      if (recordedDatesBySubject.get(subjectId)?.has(d)) n += 1;
    }
    return n / recorded;
  };
  const students = [
    ...profiles.map((p) => ({ studentId: p.userId, name: p.user.fullName, lrn: p.lrn })),
    ...rosterRows
      .filter((r) => !registeredLrns.has(r.lrn))
      .map((r) => ({ studentId: `roster:${r.id}`, name: r.fullName, lrn: r.lrn })),
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
    students: students.map((s) => ({
      studentId: s.studentId,
      name: s.name,
      lrn: s.lrn,
      rates: Object.fromEntries(
        [...subjects.keys()].map((sid) => [sid, rateOf(s.studentId, sid)]),
      ) as Record<string, number | null>,
    })),
  };
}
