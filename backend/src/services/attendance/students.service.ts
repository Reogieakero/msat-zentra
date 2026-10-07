import { prisma } from "../../lib/prisma.js";
import {
  buildDayAxis,
  countSchoolDays,
  isWeekendKey,
  studentDayOutcomes,
  sectionStrictDays,
  buildOfferedMap,
  type AttendanceStatus,
} from "../attendance.js";
import { computeAttendanceRate, computeSubjectAttendanceRate } from "../attendance.js";
import { AppError } from "../../lib/errors.js";
import {
  GRADE_NUMERIC,
  schoolYearClause,
  type DisplayTerm,
} from "../../modules/attendance/attendance.repository.js";

export interface AtRiskQuery {
  session: "AM" | "PM";
  schoolYearId: string | null;
  displayTerm: DisplayTerm;
}

// Every student under 80% of current (display-term) attendance, school-wide.
// Strict per-day basis: present = days present in EVERY offered subject that
// weekday (late/absent/excused/unrecorded break the day). Flat worst-first
// list for the Needs Attention tab. Zero-record students count as 0%.
// `session` is accepted but ignored on the strict path; it only applies to
// the legacy fallback when the term holds zero subject-era rows.
export async function getAtRiskStudents(query: AtRiskQuery) {
  const { session, schoolYearId, displayTerm } = query;
  const termId = displayTerm.id;
  const schoolDays = countSchoolDays(buildDayAxis(displayTerm.startDate));

  const [sections, profiles, rosterEntries] = await Promise.all([
    prisma.section.findMany({
      where: schoolYearClause(schoolYearId),
      select: { id: true, name: true, gradeLevel: true },
    }),
    prisma.studentProfile.findMany({
      select: {
        userId: true,
        lrn: true,
        sectionId: true,
        user: { select: { fullName: true } },
      },
    }),
    prisma.studentRoster.findMany({
      select: { id: true, lrn: true, fullName: true, sectionId: true },
    }),
  ]);
  const meta = new Map(sections.map((s) => [s.id, s]));
  const sectionIds = sections.map((s) => s.id);

  const subjectTakes = await prisma.attendanceRecord.findMany({
    where: { termId, sectionId: { in: sectionIds }, NOT: { subjectId: null } },
    select: {
      sectionId: true,
      studentId: true,
      rosterId: true,
      subjectId: true,
      date: true,
      status: true,
    },
  });

  if (subjectTakes.length === 0) {
    // Frozen legacy basis (archived AM/PM term) — original logic unchanged.
    const records = await prisma.attendanceRecord.findMany({
      where: { termId, session },
      select: { sectionId: true, studentId: true, rosterId: true, status: true },
    });

    type Agg = { present: number; late: number; absent: number; excused: number };
    const agg = new Map<string, Agg>();
    for (const r of records) {
      if (!meta.has(r.sectionId)) continue;
      const key = r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string);
      if (!agg.has(key)) agg.set(key, { present: 0, late: 0, absent: 0, excused: 0 });
      const cell = agg.get(key)!;
      if (r.status === "present") cell.present++;
      else if (r.status === "late") cell.late++;
      else if (r.status === "absent") cell.absent++;
      else if (r.status === "excused") cell.excused++;
    }

    // Enrollment, LRN-deduped (registered profile wins over roster entry).
    type Enrolled = { key: string; lrn: string; name: string; sectionId: string; hasAccount: boolean };
    const bySectionLrn = new Map<string, Enrolled>();
    for (const p of profiles) {
      if (!p.sectionId || !meta.has(p.sectionId)) continue;
      bySectionLrn.set(`${p.sectionId}|${p.lrn}`, {
        key: p.userId,
        lrn: p.lrn,
        name: p.user.fullName,
        sectionId: p.sectionId,
        hasAccount: true,
      });
    }
    for (const r of rosterEntries) {
      if (!r.sectionId || !meta.has(r.sectionId)) continue;
      const k = `${r.sectionId}|${r.lrn}`;
      if (bySectionLrn.has(k)) continue;
      bySectionLrn.set(k, {
        key: `roster:${r.id}`,
        lrn: r.lrn,
        name: r.fullName,
        sectionId: r.sectionId,
        hasAccount: false,
      });
    }

    const students = [...bySectionLrn.values()]
      .map((e) => {
        const c = agg.get(e.key) ?? { present: 0, late: 0, absent: 0, excused: 0 };
        const rate =
          schoolDays > 0 ? Math.round((c.present / schoolDays) * 1000) / 10 : 0;
        const sec = meta.get(e.sectionId)!;
        return {
          id: e.key,
          lrn: e.lrn,
          name: e.name,
          sectionId: e.sectionId,
          section: `Grade ${sec.name}`,
          gradeLevel: GRADE_NUMERIC[sec.gradeLevel] ?? sec.gradeLevel,
          present: c.present,
          late: c.late,
          absent: c.absent,
          excused: c.excused,
          rate,
          hasAccount: e.hasAccount,
        };
      })
      .filter((s) => s.rate < 80)
      .sort((a, b) => a.rate - b.rate);

    return {
      students,
      schoolDays,
      term: { id: displayTerm.id, termNumber: displayTerm.termNumber },
    };
  }

  // Strict path: day outcomes per enrolled student (LRN-deduped).
  const entries = await prisma.sectionTimetableEntry.findMany({
    where: {
      sectionId: { in: sectionIds },
      termId,
      status: { in: ["APPROVED", "SUBMITTED"] },
    },
    select: { sectionId: true, subjectId: true, day: true },
  });
  const strict = sectionStrictDays(
    subjectTakes.map((r) => ({
      sectionId: r.sectionId,
      studentKey: r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string),
      subjectId: r.subjectId as string,
      date: r.date,
      status: r.status as AttendanceStatus,
    })),
    buildOfferedMap(entries)
  );

  // Weekday axis only — weekend days never classify anyone absent.
  const outcomeKeys = buildDayAxis(displayTerm.startDate).filter(
    (k) => !isWeekendKey(k)
  );
  const days = outcomeKeys.length;

  type Enrolled = { key: string; lrn: string; name: string; sectionId: string; hasAccount: boolean };
  const bySectionLrn = new Map<string, Enrolled>();
  for (const p of profiles) {
    if (!p.sectionId || !meta.has(p.sectionId)) continue;
    bySectionLrn.set(`${p.sectionId}|${p.lrn}`, {
      key: p.userId,
      lrn: p.lrn,
      name: p.user.fullName,
      sectionId: p.sectionId,
      hasAccount: true,
    });
  }
  for (const r of rosterEntries) {
    if (!r.sectionId || !meta.has(r.sectionId)) continue;
    const k = `${r.sectionId}|${r.lrn}`;
    if (bySectionLrn.has(k)) continue;
    bySectionLrn.set(k, {
      key: `roster:${r.id}`,
      lrn: r.lrn,
      name: r.fullName,
      sectionId: r.sectionId,
      hasAccount: false,
    });
  }

  // Group enrolled keys per section for the outcome pass.
  const keysBySection = new Map<string, string[]>();
  for (const e of bySectionLrn.values()) {
    if (!keysBySection.has(e.sectionId)) keysBySection.set(e.sectionId, []);
    keysBySection.get(e.sectionId)!.push(e.key);
  }
  const outcomeByKey = new Map<
    string,
    { present: number; late: number; excused: number; absent: number }
  >();
  for (const [sectionId, keys] of keysBySection) {
    const out = studentDayOutcomes(strict.get(sectionId), keys, outcomeKeys);
    for (const [key, row] of out) outcomeByKey.set(`${sectionId}|${key}`, row);
  }

  const students = [...bySectionLrn.values()]
    .map((e) => {
      const o = outcomeByKey.get(`${e.sectionId}|${e.key}`) ?? {
        present: 0,
        late: 0,
        excused: 0,
        absent: 0,
      };
      const rate = days > 0 ? Math.round((o.present / days) * 1000) / 10 : 0;
      const sec = meta.get(e.sectionId)!;
      return {
        id: e.key,
        lrn: e.lrn,
        name: e.name,
        sectionId: e.sectionId,
        section: `Grade ${sec.name}`,
        gradeLevel: GRADE_NUMERIC[sec.gradeLevel] ?? sec.gradeLevel,
        present: o.present,
        late: o.late,
        absent: o.absent,
        excused: o.excused,
        rate,
        hasAccount: e.hasAccount,
      };
    })
    .filter((s) => s.rate < 80)
    .sort((a, b) => a.rate - b.rate);

  return {
    students,
    schoolDays: days,
    term: { id: displayTerm.id, termNumber: displayTerm.termNumber },
  };
}

export async function getStudentAttendanceRate(studentId: string, termId: string | undefined) {
  if (!termId) throw new AppError(400, "MISSING_TERM", "termId query required");
  const rate = await computeAttendanceRate(studentId, termId);
  return rate;
}

// Per-subject rate for one student (+ daily view derived from subject marks).
// :id accepts a profile uuid or `roster:<uuid>`. Omit ?subjectId= for the
// pooled overall rate across all subjects.
export async function getStudentSubjectRate(
  rawId: string,
  termId: string | undefined,
  subjectId: string | undefined,
) {
  if (!termId) throw new AppError(400, "MISSING_TERM", "termId query required");
  const who = rawId.startsWith("roster:")
    ? { rosterId: rawId.slice("roster:".length) }
    : { studentId: rawId };
  const rate = await computeSubjectAttendanceRate(who, termId, subjectId);
  return rate;
}
