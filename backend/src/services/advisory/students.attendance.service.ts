import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { buildDayAxis, isWeekendKey, schoolDaysToDate } from "../attendance.js";
import { assertAdvisee } from "./students.auth.js";
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

  const schoolDays = schoolDaysToDate(term?.startDate ?? null);
  const possible = schoolDays * 2;
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
