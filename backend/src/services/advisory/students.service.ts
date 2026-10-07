import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import {
  computeRiskFactors,
  levelFromFlags,
} from "../risk.js";
import {
  ATTENDANCE_RISK_CUTOFF,
  buildDayAxis,
  isWeekendKey,
  schoolDaysToDate,
  subjectAverageAttendance,
} from "../attendance.js";
import { sectionHeadcounts } from "../enrollment.js";
import { adviserSectionsOr404 } from "../../modules/teacher/advisory.repository.js";
import type { AdvisoryContext } from "./advisory.types.js";

// GET /api/teacher/advisory/students — advisee roster with risk chips.
// Adviser-only (404 otherwise). No anecdotal content, ever — counts and
// confidentiality tiers only.
export async function getStudents(ctx: AdvisoryContext) {
  const teacherId = ctx.userId;
  const termId = ctx.termId;
  const sections = await adviserSectionsOr404(teacherId, ctx.schoolYearId);
  if (!termId) {
    return { advisorySections: sections, termId: null, students: [] };
  }

  const sectionIds = sections.map((s) => s.id);
  // One parallel fan-out: everything that needs only (sectionIds, termId)
  // fires together — roster rows, offered subjects for the headers, and
  // the subject-average attendance feed. Nothing here waits on anything
  // else in this batch.
  const [counts, advisees, rosterEntries, assignSubjects, entrySubjects, subjectAvgs] =
    await Promise.all([
      prisma.studentProfile.groupBy({
        by: ["sectionId"],
        where: { sectionId: { in: sectionIds } },
        _count: { _all: true },
      }),
      prisma.studentProfile.findMany({
        where: { sectionId: { in: sectionIds } },
        include: {
          user: { select: { fullName: true } },
          section: { select: { id: true, name: true } },
          finalGrades: {
            where: { termId },
            select: {
              computedAverage: true,
              transmutedGrade: true,
              subject: { select: { name: true, code: true } },
            },
          },
          attendanceRecords: { where: { termId }, select: { status: true } },
          anecdotalRecords: {
            where: { termId },
            select: { confidentialityLevel: true, category: true },
          },
          gradeFlags: { where: { termId }, select: { status: true } },
        },
        orderBy: { user: { fullName: "asc" } },
      }),
      // Enlisted but not yet registered: roster rows with no login account.
      prisma.studentRoster.findMany({
        where: { sectionId: { in: sectionIds } },
        select: {
          id: true,
          lrn: true,
          fullName: true,
          sectionId: true,
          section: { select: { name: true } },
        },
        orderBy: { fullName: "asc" },
      }),
      // Offered subjects for these sections + term (assignments and
      // timetable rows): table headers come from here so subject-code
      // columns render even before any grade is encoded.
      prisma.teacherSubjectAssignment.findMany({
        where: { sectionId: { in: sectionIds }, termId },
        select: { subject: { select: { name: true, code: true } } },
        distinct: ["subjectId"],
      }),
      prisma.sectionTimetableEntry.findMany({
        where: { sectionId: { in: sectionIds }, termId },
        select: { subject: { select: { name: true, code: true } } },
        distinct: ["subjectId"],
      }),
      // Attendance at-risk feed — needs only (sectionIds, termId), so it
      // runs with the roster batch instead of blocking the response build.
      subjectAverageAttendance(sectionIds, termId),
    ]);
  // Roster-aware attendance denominators: enlisted students without
  // accounts count toward the section headcount too. The profile groupBy
  // above is reused (no second scan).
  const registeredLrns = new Set(advisees.map((s) => s.lrn));
  const rosterOnly = rosterEntries.filter((r) => !registeredLrns.has(r.lrn));
  const rosterIds = rosterOnly.map((r) => r.id);
  const profileIds = advisees.map((s) => s.userId);

  // Live inputs for roster rows: finals, attendance, anecdotal tiers, and
  // raw assessment means — the same engine inputs profiles get, so risk
  // levels respect the engine for every advisee. The roster-aware
  // headcount rides along (profile groupBy reused, no second scan).
  const [rosterFinals, rosterAttendance, rosterAnecdotal, rawRows, enrolledBySection] =
    await Promise.all([
    rosterIds.length > 0
      ? prisma.finalGrade.findMany({
          where: { rosterId: { in: rosterIds }, termId },
          select: {
            rosterId: true,
            computedAverage: true,
            transmutedGrade: true,
            subject: { select: { name: true, code: true } },
          },
        })
      : Promise.resolve([]),
    rosterIds.length > 0
      ? prisma.attendanceRecord.findMany({
          where: { rosterId: { in: rosterIds }, termId },
          select: { rosterId: true, status: true },
        })
      : Promise.resolve([]),
    rosterIds.length > 0
      ? prisma.anecdotalRecord.findMany({
          where: { rosterId: { in: rosterIds }, termId },
          select: { rosterId: true, confidentialityLevel: true },
        })
      : Promise.resolve([]),
    termId
      ? prisma.studentGrade.findMany({
          where: {
            assessment: { gradeComponent: { termId } },
            OR: [
              ...(profileIds.length > 0 ? [{ studentId: { in: profileIds } }] : []),
              ...(rosterIds.length > 0 ? [{ rosterId: { in: rosterIds } }] : []),
            ],
          },
          select: {
            studentId: true,
            rosterId: true,
            percentageScore: true,
            assessment: { select: { gradeComponent: { select: { subjectId: true } } } },
          },
        })
      : Promise.resolve([]),
    // Roster-aware headcount (profile groupBy from the first batch is
    // reused — no second scan for the same sections).
    sectionHeadcounts(sectionIds, counts),
  ]);

  const finalsByRoster = new Map<string, typeof rosterFinals>();
  for (const f of rosterFinals) {
    const arr = finalsByRoster.get(f.rosterId as string) ?? [];
    arr.push(f);
    finalsByRoster.set(f.rosterId as string, arr);
  }
  const attendanceByRoster = new Map<string, { status: string }[]>();
  for (const r of rosterAttendance) {
    const arr = attendanceByRoster.get(r.rosterId as string) ?? [];
    arr.push({ status: r.status });
    attendanceByRoster.set(r.rosterId as string, arr);
  }
  const anecdotalByRoster = new Map<string, { confidentialityLevel: string }[]>();
  for (const r of rosterAnecdotal) {
    const arr = anecdotalByRoster.get(r.rosterId as string) ?? [];
    arr.push({ confidentialityLevel: r.confidentialityLevel });
    anecdotalByRoster.set(r.rosterId as string, arr);
  }
  // Per-student raw subject means (unweighted) for the raw-grade check.
  const rawBySubject = new Map<string, Map<string, { sum: number; count: number }>>();
  for (const row of rawRows) {
    const key = row.studentId ?? `roster:${row.rosterId}`;
    const subjectId = row.assessment.gradeComponent.subjectId;
    if (!rawBySubject.has(key)) rawBySubject.set(key, new Map());
    const perSubject = rawBySubject.get(key)!;
    const cell = perSubject.get(subjectId) ?? { sum: 0, count: 0 };
    cell.sum += row.percentageScore;
    cell.count += 1;
    perSubject.set(subjectId, cell);
  }
  const rawAveragesFor = (key: string): number[] =>
    Array.from((rawBySubject.get(key) ?? new Map()).values()).map(
      (cell) => cell.sum / cell.count,
    );

  // Live per-subject raw means (realtime academic feed): unweighted mean
  // of recorded percentage scores per student per subject — the same
  // basis as the risk engine's raw check. Reported regardless of lock /
  // finalization status, so the advisory table updates as scores land.
  const liveGradesByKey = new Map<string, { subjectId: string; average: number }[]>();
  for (const [key, perSubject] of rawBySubject) {
    const arr: { subjectId: string; average: number }[] = [];
    for (const [subjectId, cell] of perSubject) {
      if (cell.count > 0) {
        arr.push({
          subjectId,
          average: Math.round((cell.sum / cell.count) * 10) / 10,
        });
      }
    }
    if (arr.length > 0) liveGradesByKey.set(key, arr);
  }
  const liveSubjectIds = [
    ...new Set([...liveGradesByKey.values()].flatMap((a) => a.map((g) => g.subjectId))),
  ];
  const liveSubjectById = new Map(
    (
      liveSubjectIds.length > 0
        ? await prisma.subject.findMany({
            where: { id: { in: liveSubjectIds } },
            select: { id: true, name: true, code: true },
          })
        : []
    ).map((s) => [s.id, s]),
  );
  const liveGradesFor = (
    key: string,
  ): { subject: string; code: string; average: number }[] =>
    (liveGradesByKey.get(key) ?? [])
      .map((g) => {
        const meta = liveSubjectById.get(g.subjectId);
        if (!meta) return null;
        return { subject: meta.name, code: meta.code, average: g.average };
      })
      .filter(
        (g): g is { subject: string; code: string; average: number } =>
          g !== null,
      )
      .sort((a, b) => a.subject.localeCompare(b.subject));

  const toActiveFlags = (flags: { academicFlag: boolean; attendanceFlag: boolean; behavioralFlag: boolean }) => {
    const active: ("academic" | "attendance" | "behavioral")[] = [];
    if (flags.academicFlag) active.push("academic");
    if (flags.attendanceFlag) active.push("attendance");
    if (flags.behavioralFlag) active.push("behavioral");
    return active;
  };

  // Attendance at-risk follows the general average across all subjects
  // (mean of per-subject present / elapsed rates — same definition as
  // the advisory attendance display), never AM/PM sessions. An entry
  // exists whenever elapsed meetups exist, so a student with no takes
  // scores 0% and flags — matching the display. Only when nothing
  // elapsed (no entry) is the legacy engine result kept. subjectAvgs
  // was fetched with the first parallel batch above.
  const withSubjectAverage = <T extends { attendanceFlag: boolean }>(
    key: string,
    flags: T,
  ): T => {
    const subjAvg = subjectAvgs.get(key);
    if (subjAvg) {
      flags.attendanceFlag = subjAvg.average < ATTENDANCE_RISK_CUTOFF;
    }
    return flags;
  };

  const students = [
    ...advisees.map((s) => {
      const enrolled = enrolledBySection.get(s.sectionId!) ?? 0;
      const factors = withSubjectAverage(
        s.userId,
        computeRiskFactors({
          finalGrades: s.finalGrades,
          rawAverages: rawAveragesFor(s.userId),
          attendance: s.attendanceRecords,
          anecdotalCount: s.anecdotalRecords.length,
          enrolled,
        }),
      );
      const activeFlags = toActiveFlags(factors);
      const present = s.attendanceRecords.filter((r) => r.status === "present").length;
      const total = s.attendanceRecords.length;
      const openFlags = s.gradeFlags.filter((g) => g.status !== "resolved").length;
      return {
        studentId: s.userId,
        name: s.user.fullName,
        lrn: s.lrn,
        birthdate: s.birthdate,
        gender: s.gender,
        section: s.section?.name ?? "",
        riskLevel: levelFromFlags(factors),
        flags: activeFlags,
        attendanceRate: total === 0 ? 1 : present / total,
        anecdotalCount: s.anecdotalRecords.length,
        confidentialityTiers: Array.from(
          new Set(s.anecdotalRecords.map((a) => a.confidentialityLevel))
        ),
        hasOpenFlag: openFlags > 0,
        openFlagCount: openFlags,
        hasAccount: true,
        grades: s.finalGrades.map((f) => ({
          subject: f.subject.name,
          code: f.subject.code,
          computedAverage: f.computedAverage,
          transmutedGrade: f.transmutedGrade,
        })),
        liveGrades: liveGradesFor(s.userId),
      };
    }),
    // Roster-only enlistments (no login account yet) — never duplicated
    // with registered profiles (matched by LRN), fully engine-scored.
    ...rosterOnly.map((r) => {
      const key = `roster:${r.id}`;
      const finals = finalsByRoster.get(r.id) ?? [];
      const att = attendanceByRoster.get(r.id) ?? [];
      const anec = anecdotalByRoster.get(r.id) ?? [];
      const enrolled = enrolledBySection.get(r.sectionId) ?? 0;
      const factors = withSubjectAverage(
        key,
        computeRiskFactors({
          finalGrades: finals,
          rawAverages: rawAveragesFor(key),
          attendance: att,
          anecdotalCount: anec.length,
          enrolled,
        }),
      );
      const activeFlags = toActiveFlags(factors);
      const present = att.filter((a) => a.status === "present").length;
      return {
        studentId: key,
        name: r.fullName,
        lrn: r.lrn,
        birthdate: null,
        gender: null,
        section: r.section.name,
        riskLevel: levelFromFlags(factors),
        flags: activeFlags,
        attendanceRate: att.length === 0 ? 1 : present / att.length,
        anecdotalCount: anec.length,
        confidentialityTiers: Array.from(new Set(anec.map((a) => a.confidentialityLevel))),
        hasOpenFlag: false,
        openFlagCount: 0,
        hasAccount: false,
        grades: finals.map((f) => ({
          subject: f.subject.name,
          code: f.subject.code,
          computedAverage: f.computedAverage,
          transmutedGrade: f.transmutedGrade,
        })),
        liveGrades: liveGradesFor(key),
      };
    }),
  ];

  // No archive scoping: every advisee in the section always lists.
  return {
    advisorySections: sections,
    termId,
    students,
    subjects: [...new Map(
      [...assignSubjects, ...entrySubjects].map((s) => [s.subject.name, s.subject]),
    ).values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// Shared advisee check: returns the profile when the student sits in one of
// the caller's advisory sections, otherwise throws 404 (uniform, no probing).
async function assertAdvisee(teacherId: string, studentId: string) {
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

// GET /api/teacher/advisory/students/:id/anecdotal — anecdotal records for one
// advisee (active term). Own records come back in full; anyone else's come back
// metadata-only (date, category, tier, follow-up count) — never the write-up.
export async function getStudentAnecdotal(ctx: AdvisoryContext, studentId: string) {
  const teacherId = ctx.userId;
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(404, "NO_ACTIVE_TERM", "No active term");
  }
  const student = await assertAdvisee(teacherId, studentId);

  const records = await prisma.anecdotalRecord.findMany({
    where: { studentId, termId },
    include: {
      observer: { select: { id: true, fullName: true } },
      followups: {
        include: { followupUser: { select: { id: true, fullName: true } } },
        orderBy: { followupDate: "asc" },
      },
    },
    orderBy: { observationDatetime: "desc" },
  });

  return {
    student: {
      studentId: student.userId,
      name: student.user.fullName,
      lrn: student.lrn,
      section: student.section?.name ?? "",
    },
    records: records.map((r) => {
      const base = {
        id: r.id,
        observationDatetime: r.observationDatetime,
        category: r.category,
        confidentialityLevel: r.confidentialityLevel,
        mine: r.observerId === teacherId,
      };
      if (r.observerId !== teacherId) {
        return { ...base, followupCount: r.followups.length };
      }
      return {
        ...base,
        location: r.descriptionOfLocation,
        incident: r.descriptionOfIncident,
        notes: r.notesRecommendationsActions,
        classPerformance: r.classPerformance,
        attendanceSummary: r.attendanceSummary,
        followups: r.followups.map((f) => ({
          id: f.id,
          by: f.followupUser.fullName,
          date: f.followupDate,
          notes: f.notes,
        })),
      };
    }),
  };
}

// GET /api/teacher/advisory/students/:id/attendance — attendance for one
// advisee (active term): summary rate plus per-day AM/PM sessions.
export async function getStudentAttendance(ctx: AdvisoryContext, rawId: string) {
  const teacherId = ctx.userId;
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(404, "NO_ACTIVE_TERM", "No active term");
  }
  // Enlisted students without accounts resolve under `roster:<id>` — no
  // account is required to view their attendance record.
  const isRoster = rawId.startsWith("roster:");
  const student = isRoster
    ? await (async () => {
        const entry = await prisma.studentRoster.findUnique({
          where: { id: rawId.slice("roster:".length) },
          include: {
            section: { select: { id: true, name: true, adviserId: true } },
          },
        });
        if (!entry || entry.section?.adviserId !== teacherId) {
          throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
        }
        return {
          userId: rawId,
          fullName: entry.fullName,
          lrn: entry.lrn,
          section: entry.section,
          rosterId: entry.id,
          studentId: null as string | null,
        };
      })()
    : await (async () => {
        const profile = await assertAdvisee(teacherId, rawId);
        return {
          userId: profile.userId,
          fullName: profile.user.fullName,
          lrn: profile.lrn,
          section: profile.section,
          rosterId: null as string | null,
          studentId: profile.userId,
        };
      })();

  const recordWhere = isRoster
    ? { rosterId: student.rosterId as string, termId }
    : { studentId: student.studentId as string, termId };
  const [records, term] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: recordWhere,
      select: {
        date: true,
        session: true,
        status: true,
        subjectId: true,
        slot: true,
        subject: { select: { name: true, code: true } },
      },
      orderBy: [{ date: "desc" }, { session: "asc" }],
    }),
    prisma.term.findUnique({ where: { id: termId }, select: { startDate: true } }),
  ]);

  // Denominator = every school-day session since term start (AM + PM per
  // weekday). There is no "unmarked" state on this surface: a school-day
  // session with no submitted record reads as absent — the only statuses
  // are present, absent, late, and excused.
  const schoolDays = schoolDaysToDate(term?.startDate ?? null);
  const possible = schoolDays * 2;
  // Weekday-only counts so the summary matches the calendar axis:
  // legacy seed rows exist on weekends and must not inflate the total.
  const weekdayRecords = records.filter(
    (r) => !isWeekendKey(r.date.toISOString().slice(0, 10))
  );
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const r of weekdayRecords) counts[r.status]++;
  const unrecorded = Math.max(0, possible - records.length);
  const absent = counts.absent + unrecorded;
  const rate = possible === 0 ? 1 : counts.present / possible;
  const summary = {
    present: counts.present,
    absent,
    late: counts.late,
    excused: counts.excused,
    total: possible,
    schoolDays,
    rate,
    isRisk: rate < 0.8,
  };

  // Full school-day axis from term start through today (weekdays only):
  // days without records render as unmarked, so gaps are visible instead
  // of silently collapsing the timeline.
  const byDate = new Map<string, Record<string, string>>();
  const subjectsByDate = new Map<
    string,
    Record<string, { status: string; slot: number; name: string; code: string }>
  >();
  const subjectTotals = new Map<
    string,
    { name: string; code: string; present: number; total: number }
  >();
  const subjectCounts = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
  for (const r of records) {
    const key = r.date.toISOString().slice(0, 10);
    if (r.subjectId) {
      if (isWeekendKey(key)) continue;
      const perDay = subjectsByDate.get(key) ?? {};
      // Same subject twice in one day (slot>1): keep the worst status so
      // a missed period is never hidden behind a present one.
      const rank = (s: string) =>
        s === "absent" ? 3 : s === "late" ? 2 : s === "excused" ? 1 : 0;
      const prev = perDay[r.subjectId];
      if (!prev || rank(r.status) > rank(prev.status)) {
        perDay[r.subjectId] = {
          status: r.status,
          slot: r.slot,
          name: r.subject?.name ?? r.subjectId,
          code: r.subject?.code ?? r.subjectId,
        };
      }
      subjectsByDate.set(key, perDay);
      subjectCounts.total += 1;
      if (r.status === "present") subjectCounts.present++;
      else if (r.status === "absent") subjectCounts.absent++;
      else if (r.status === "late") subjectCounts.late++;
      else if (r.status === "excused") subjectCounts.excused++;
      const agg = subjectTotals.get(r.subjectId) ?? {
        name: r.subject?.name ?? r.subjectId,
        code: r.subject?.code ?? r.subjectId,
        present: 0,
        total: 0,
      };
      agg.total += 1;
      if (r.status === "present") agg.present += 1;
      subjectTotals.set(r.subjectId, agg);
    } else {
      const sessions = byDate.get(key) ?? {};
      sessions[r.session] = r.status;
      byDate.set(key, sessions);
    }
  }
  const days = buildDayAxis(term?.startDate ?? null)
    .filter((key) => !isWeekendKey(key))
    .reverse()
    .map((key) => {
      const sessions = byDate.get(key) ?? {};
      return {
        date: key,
        sessions: {
          AM: sessions.AM ?? "absent",
          PM: sessions.PM ?? "absent",
        },
        subjects: subjectsByDate.get(key) ?? {},
      };
    });
  // Overall subject rate + per-subject breakdown (null when the student
  // has only legacy AM/PM rows — the daily sessions view stays canonical).
  const hasSubjectRows = subjectCounts.total > 0;
  const subjectSummary = hasSubjectRows
    ? {
        present: subjectCounts.present,
        absent: subjectCounts.absent,
        late: subjectCounts.late,
        excused: subjectCounts.excused,
        total: subjectCounts.total,
        rate: subjectCounts.present / subjectCounts.total,
        isRisk: subjectCounts.present / subjectCounts.total < 0.8,
        bySubject: [...subjectTotals.entries()].map(([subjectId, agg]) => ({
          subjectId,
          name: agg.name,
          code: agg.code,
          present: agg.present,
          total: agg.total,
          rate: agg.total > 0 ? agg.present / agg.total : 1,
        })),
      }
    : null;

  return {
    student: {
      studentId: student.userId,
      name: student.fullName,
      lrn: student.lrn,
      section: student.section?.name ?? "",
    },
    summary,
    subjectSummary,
    termStart: term?.startDate ?? null,
    days,
  };
}

// GET /api/teacher/advisory/students/:id/academic — subject grades for one
// advisee (active term), read-only. Includes a passed/failed summary.
export async function getStudentAcademic(ctx: AdvisoryContext, rawId: string) {
  const teacherId = ctx.userId;
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(404, "NO_ACTIVE_TERM", "No active term");
  }
  // Enlisted students without accounts resolve under `roster:<id>` — no
  // account is required to view their academic record.
  const isRoster = rawId.startsWith("roster:");
  const student = isRoster
    ? await (async () => {
        const entry = await prisma.studentRoster.findUnique({
          where: { id: rawId.slice("roster:".length) },
          include: {
            section: { select: { id: true, name: true, adviserId: true } },
          },
        });
        if (!entry || entry.section?.adviserId !== teacherId) {
          throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
        }
        return {
          userId: rawId,
          fullName: entry.fullName,
          lrn: entry.lrn,
          section: entry.section,
          rosterId: entry.id,
          studentId: null as string | null,
        };
      })()
    : await (async () => {
        const profile = await assertAdvisee(teacherId, rawId);
        return {
          userId: profile.userId,
          fullName: profile.user.fullName,
          lrn: profile.lrn,
          section: profile.section,
          rosterId: null as string | null,
          studentId: profile.userId,
        };
      })();

  const gradeWhere = isRoster
    ? { rosterId: student.rosterId as string, termId }
    : { studentId: student.studentId as string, termId };
  const [grades, sectionSubjects] = await Promise.all([
    prisma.finalGrade.findMany({
      where: gradeWhere,
      include: { subject: { select: { id: true, name: true } } },
    }),
    // Every subject offered in the student's section — so subjects with
    // no encoded grade yet still display (as ungraded raw rows).
    prisma.teacherSubjectAssignment.findMany({
      where: { sectionId: student.section!.id },
      select: { subject: { select: { id: true, name: true } } },
      distinct: ["subjectId"],
    }),
  ]);

  const bySubjectId = new Map(grades.map((g) => [g.subject.id, g]));
  const subjectIds = new Set<string>([
    ...grades.map((g) => g.subject.id),
    ...sectionSubjects.map((a) => a.subject.id),
  ]);
  const subjectNames = new Map<string, string>([
    ...grades.map((g) => [g.subject.id, g.subject.name] as const),
    ...sectionSubjects.map((a) => [a.subject.id, a.subject.name] as const),
  ]);

  interface GradeRow {
    subject: string;
    computedAverage: number | null;
    transmutedGrade: number | null;
    remarks: string | null;
    lockStatus: string | null;
  }
  const rows: GradeRow[] = Array.from(subjectIds)
    .map((subjectId) => {
      const g = bySubjectId.get(subjectId);
      if (!g) {
        return {
          subject: subjectNames.get(subjectId) ?? "",
          computedAverage: null,
          transmutedGrade: null,
          remarks: null,
          lockStatus: null,
        };
      }
      return {
        subject: g.subject.name,
        computedAverage: g.computedAverage,
        transmutedGrade: g.transmutedGrade,
        remarks: g.remarks,
        lockStatus: g.lockStatus,
      };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject));

  const gradedRows = rows.filter((g) => g.computedAverage !== null);
  const passed = rows.filter((g) => g.remarks === "Passed").length;
  const failed = rows.filter((g) => g.remarks === "Failed").length;

  return {
    student: {
      studentId: student.userId,
      name: student.fullName,
      lrn: student.lrn,
      section: student.section?.name ?? "",
    },
    grades: rows,
    summary: {
      subjects: rows.length,
      graded: gradedRows.length,
      passed,
      failed,
      average:
        gradedRows.length === 0
          ? null
          : gradedRows.reduce((sum, g) => sum + (g.computedAverage ?? 0), 0) /
            gradedRows.length,
    },
  };
}

// GET /api/teacher/advisory/students/:id — drawer detail for one advisee.
// 404 unless the student is in the caller's advisory section. Referrals and
// ADM come back status/stage-only; anecdotal content is never included.
export async function getStudentDetail(ctx: AdvisoryContext, studentId: string) {
  const teacherId = ctx.userId;
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(404, "NO_ACTIVE_TERM", "No active term");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
    include: {
      user: { select: { fullName: true } },
      section: { select: { id: true, name: true, gradeLevel: true, adviserId: true } },
      finalGrades: {
        where: { termId },
        include: { subject: { select: { id: true, name: true } } },
      },
      attendanceRecords: { where: { termId }, select: { status: true } },
      anecdotalRecords: {
        where: { termId },
        select: { confidentialityLevel: true, category: true },
      },
      referrals: {
        where: { termId },
        select: { id: true, referredToRole: true, status: true },
        orderBy: { id: "desc" },
      },
      admProfiles: {
        where: { termId },
        select: { id: true, stage: true, eligibilityStatus: true },
      },
      gradeFlags: {
        include: {
          subject: { select: { id: true, name: true } },
          raisedByUser: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!student || student.section?.adviserId !== teacherId) {
    throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  }

  const present = student.attendanceRecords.filter((r) => r.status === "present").length;
  const absent = student.attendanceRecords.filter((r) => r.status === "absent").length;
  const late = student.attendanceRecords.filter((r) => r.status === "late").length;
  const excused = student.attendanceRecords.filter((r) => r.status === "excused").length;
  const total = student.attendanceRecords.length;

  return {
    studentId: student.userId,
    name: student.user.fullName,
    lrn: student.lrn,
    birthdate: student.birthdate,
    gender: student.gender,
    section: student.section.name,
    gradeLevel: student.section.gradeLevel,
    grades: student.finalGrades.map((g) => ({
      subject: g.subject.name,
      computedAverage: g.computedAverage,
      transmutedGrade: g.transmutedGrade,
      remarks: g.remarks,
      lockStatus: g.lockStatus,
    })),
    attendance: {
      rate: total === 0 ? 1 : present / total,
      present,
      absent,
      late,
      excused,
      total,
    },
    anecdotal: {
      count: student.anecdotalRecords.length,
      tiers: Array.from(new Set(student.anecdotalRecords.map((a) => a.confidentialityLevel))),
      categories: Array.from(new Set(student.anecdotalRecords.map((a) => a.category))),
    },
    referrals: student.referrals.map((r) => ({
      id: r.id,
      target: r.referredToRole,
      status: r.status,
    })),
    admCases: student.admProfiles.map((a) => ({
      id: a.id,
      stage: a.stage,
      eligibility: a.eligibilityStatus,
    })),
    gradeFlags: student.gradeFlags.map((f) => ({
      id: f.id,
      reason: f.reason,
      note: f.note,
      status: f.status,
      subject: f.subject.name,
      raisedBy: f.raisedByUser.fullName,
      createdAt: f.createdAt,
      resolutionNote: f.resolutionNote,
      resolvedAt: f.resolvedAt,
    })),
  };
}
