import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { isArchivedAdvisoryLearner } from "../../lib/learnerVisibility.js";
import { buildDayAxis, isWeekendKey, schoolDaysToDate, termHasStarted } from "../attendance.js";
import { loadSubjectMeetups } from "../attendance/sections.service.js";
import { assertAdvisee } from "./students.auth.js";
import { sharingMap, canBypassSharing } from "../teacher/dataShare.service.js";
import type { AdvisoryContext } from "./advisory.types.js";

export async function getStudentAttendance(ctx: AdvisoryContext, rawId: string) {
  const teacherId = ctx.userId;
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(404, "NO_ACTIVE_TERM", "No active term");
  }
  const isRoster = rawId.startsWith("roster:");
  const student = isRoster
    ? await (async () => {
        const entry = await prisma.studentRoster.findUnique({
          where: { id: rawId.slice("roster:".length) },
          include: {
            section: { select: { id: true, name: true, adviserId: true } },
          },
        });
        if (
          !entry ||
          entry.section?.adviserId !== teacherId ||
          (await isArchivedAdvisoryLearner({ rosterId: entry.id }))
        ) {
          throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
        }
        return {
          userId: rawId,
          fullName: entry.fullName,
          lrn: entry.lrn,
          section: entry.section,
          rosterId: entry.id,
          learnerType: entry.learnerType,
          enrolledAt: entry.createdAt,
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
          learnerType: null as "regular" | "transferee" | null,
          enrolledAt: null as Date | null,
          studentId: profile.userId,
        };
      })();

  const recordWhere = isRoster
    ? { rosterId: student.rosterId as string, termId }
    : { studentId: student.studentId as string, termId };
  const [allRecords, term] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: recordWhere,
      select: {
        date: true,
        session: true,
        status: true,
        subjectId: true,
        slot: true,
        recordedBy: true,
        assignmentId: true,
        assignment: { select: { teacherId: true } },
        subject: { select: { name: true, code: true } },
      },
      orderBy: [{ date: "desc" }, { session: "asc" }],
    }),
    prisma.term.findUnique({
      where: { id: termId },
      select: { startDate: true, endDate: true },
    }),
  ]);

  // A term that has not started yet is outside its scope period: report no
  // sessions rather than a misleading "0 of 0 · 100%" derived from an empty axis.
  if (!termHasStarted(term?.startDate)) {
    return {
      student: {
        studentId: student.userId,
        name: student.fullName,
        lrn: student.lrn,
        section: student.section?.name ?? "",
      },
      summary: {
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0,
        schoolDays: 0,
        rate: 0,
        isRisk: false,
      },
      subjectSummary: null,
      restricted: false,
      termStart: term?.startDate ?? null,
      days: [],
    };
  }

  // Sharing: hide marks owned by private teachers (unless requester bypasses).
  const ownerIds = [
    ...new Set(
      allRecords.map((r) => r.assignment?.teacherId ?? r.recordedBy).filter((v): v is string => !!v),
    ),
  ];
  const shareByTeacher = await sharingMap(ownerIds);
  const records = allRecords.filter((r) => {
    const owner = r.assignment?.teacherId ?? r.recordedBy;
    if (!owner) return true;
    if (canBypassSharing(ctx.role, teacherId, [owner])) return true;
    return shareByTeacher.get(owner) === true;
  });
  const restricted = records.length !== allRecords.length;

  // Transferees are rated from the day AFTER their enlistment: that day's
  // sessions may already have been taken without them, so a fresh transferee
  // must not read "0 of N sessions — at risk" the moment they are added. The
  // same window is used by the risk engine and the auto-absent sweep.
  const enlistment = student.enrolledAt;
  const learnerStart =
    student.learnerType === "transferee" && enlistment
      ? new Date(enlistment.getTime() + 86_400_000)
      : null;
  const termStart = term?.startDate ?? null;
  const axisStart =
    learnerStart && (!termStart || learnerStart > termStart) ? learnerStart : termStart;
  const axisStartKey = axisStart ? axisStart.toISOString().slice(0, 10) : null;
  const scoped =
    axisStartKey === null
      ? records
      : records.filter((r) => r.date.toISOString().slice(0, 10) >= axisStartKey);

  // Subject attendance is rated on scheduled meetups — the same per-subject
  // windows the attendance desk and the risk engine use. The legacy `summary`
  // below counts the AM/PM axis (2 sessions per school day) and only applies to
  // sections that never record attendance per subject; reading it for a
  // subject-based section is what made this card disagree with that desk.
  const sectionId = student.section?.id ?? null;
  const meetupPlan = sectionId ? await loadSubjectMeetups(sectionId, termId) : null;
  const enlistStr =
    student.learnerType === "transferee" && student.enrolledAt
      ? student.enrolledAt.toISOString().slice(0, 10)
      : null;
  const presentSlotsBySubjectDate = new Map<string, Map<string, Set<number>>>();
  for (const r of scoped) {
    if (!r.subjectId || r.status !== "present") continue;
    let byDate = presentSlotsBySubjectDate.get(r.subjectId);
    if (!byDate) {
      byDate = new Map();
      presentSlotsBySubjectDate.set(r.subjectId, byDate);
    }
    const dateKey = r.date.toISOString().slice(0, 10);
    let slots = byDate.get(dateKey);
    if (!slots) {
      slots = new Set();
      byDate.set(dateKey, slots);
    }
    slots.add(r.slot);
  }
  const subjectRows =
    meetupPlan?.termStarted
      ? [...meetupPlan.subjects.values()].flatMap((subject) => {
          const scheduled = meetupPlan.scheduledCountBySubjectDate.get(subject.id);
          const counts =
            scheduled && scheduled.size > 0
              ? scheduled
              : meetupPlan.recordedCountBySubjectDate.get(subject.id);
          if (!counts || counts.size === 0) return [];
          const presentByDate = presentSlotsBySubjectDate.get(subject.id);
          let total = 0;
          let present = 0;
          for (const [date, count] of counts) {
            if (enlistStr && date <= enlistStr) continue;
            total += count;
            present += Math.min(count, presentByDate?.get(date)?.size ?? 0);
          }
          if (total === 0) return [];
          return [
            {
              subjectId: subject.id,
              name: subject.name,
              code: subject.code,
              present,
              total,
              rate: present / total,
            },
          ];
        })
      : [];

  const schoolDays = schoolDaysToDate(axisStart, term?.endDate ?? null);
  const possible = schoolDays * 2;
  const weekdayRecords = scoped.filter(
    (r) => !isWeekendKey(r.date.toISOString().slice(0, 10))
  );
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const r of weekdayRecords) counts[r.status]++;
  const unrecorded = Math.max(0, possible - scoped.length);
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

  const byDate = new Map<string, Record<string, string>>();
  const subjectsByDate = new Map<
    string,
    Record<string, { status: string; slot: number; name: string; code: string }>
  >();
  for (const r of scoped) {
    const key = r.date.toISOString().slice(0, 10);
    if (r.subjectId) {
      if (isWeekendKey(key)) continue;
      const perDay = subjectsByDate.get(key) ?? {};
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
    } else {
      const sessions = byDate.get(key) ?? {};
      sessions[r.session] = r.status;
      byDate.set(key, sessions);
    }
  }
  const days = buildDayAxis(axisStart, term?.endDate ?? null)
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
  const subjectTotals = subjectRows.reduce(
    (acc, row) => ({ present: acc.present + row.present, total: acc.total + row.total }),
    { present: 0, total: 0 },
  );
  // Subject-based sections always report through this summary (even at 0 of 0),
  // so the card never falls back to the legacy AM/PM axis and disagrees with
  // the attendance desk's per-subject meetup counts.
  const subjectSummary =
    meetupPlan?.termStarted && meetupPlan.subjects.size > 0
      ? {
          present: subjectTotals.present,
          absent: Math.max(0, subjectTotals.total - subjectTotals.present),
          late: 0,
          excused: 0,
          total: subjectTotals.total,
          rate: subjectTotals.total > 0 ? subjectTotals.present / subjectTotals.total : 0,
          isRisk: subjectTotals.total > 0 && subjectTotals.present / subjectTotals.total < 0.8,
          bySubject: subjectRows,
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
    restricted,
    termStart: term?.startDate ?? null,
    days,
  };
}
