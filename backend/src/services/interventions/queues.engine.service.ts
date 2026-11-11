import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { loadSubjectMeetups } from "../attendance/sections.service.js";
import { evaluateRisk, evaluateRosterRisk, recomputeRisk, recomputeRosterRisk } from "../risk.js";

export interface EngineQuery {
  studentId: string | null;
  rosterId: string | null;
  termId: string | null;
}

export async function getEngineBreakdown(query: EngineQuery) {
  const { studentId, rosterId, termId } = query;
  if ((studentId && rosterId) || (!studentId && !rosterId)) {
    throw new AppError(400, "INVALID_ACTION", "Pick exactly one student");
  }
  if (!termId) throw new AppError(400, "NO_ACTIVE_TERM", "No active term to evaluate");
  const live = studentId
    ? await evaluateRisk(studentId, termId)
    : await evaluateRosterRisk(rosterId!, termId);

  const gradeWhere = studentId ? { studentId, termId } : { rosterId: rosterId!, termId };
  const attWhere = studentId ? { studentId, termId } : { rosterId: rosterId!, termId };
  const sectionSource = studentId
    ? prisma.studentProfile
        .findUnique({ where: { userId: studentId }, select: { sectionId: true } })
        .then((p) => ({ sectionId: p?.sectionId ?? null, learnerStart: null as Date | null }))
    : prisma.studentRoster
        .findUnique({
          where: { id: rosterId! },
          select: { sectionId: true, learnerType: true, createdAt: true },
        })
        .then((r) => ({
          sectionId: r?.sectionId ?? null,
          learnerStart: r?.learnerType === "transferee" ? r.createdAt : null,
        }));
  const [grades, attendance, anecdotals, snapshot, flagged, section] = await Promise.all([
    prisma.finalGrade.findMany({
      where: gradeWhere,
      select: {
        computedAverage: true,
        transmutedGrade: true,
        subject: { select: { name: true, code: true } },
      },
      orderBy: { subject: { name: "asc" } },
    }),
    prisma.attendanceRecord.findMany({
      where: attWhere,
      select: {
        status: true,
        subjectId: true,
        date: true,
        slot: true,
        subject: { select: { name: true, code: true } },
      },
    }),
    prisma.anecdotalRecord.findMany({
      where: studentId
        ? { studentId, termId, deletedAt: null }
        : { rosterId: rosterId!, termId, deletedAt: null },
      select: { category: true, observationDatetime: true },
      orderBy: { observationDatetime: "desc" },
      take: 5,
    }),
    prisma.riskSnapshot.findFirst({
      where: studentId ? { studentId, termId } : { rosterId: rosterId!, termId },
      orderBy: { snapshotDate: "desc" },
      select: { riskLevel: true, riskCount: true, snapshotDate: true },
    }),
    prisma.intervention.findFirst({
      where: studentId ? { studentId } : { rosterId: rosterId! },
      orderBy: { id: "desc" },
      select: { riskLevelAtFlag: true },
    }),
    sectionSource,
  ]);

  const present = attendance.filter((a) => a.status === "present").length;
  const subjectEra = attendance.some((a) => a.subjectId !== null);

  // Attendance is rated on scheduled meetups — the same denominator the teacher
  // advisory card and the risk engine use (`loadSubjectMeetups`). A learner with
  // no marks yet therefore reads "0 of N" (the reason the engine flags them)
  // instead of "—", which made this card disagree with the advisory desk.
  const meetupPlan = section.sectionId
    ? await loadSubjectMeetups(section.sectionId, termId)
    : null;
  let meetupPresent = 0;
  let meetupTotal = 0;
  if (meetupPlan?.termStarted && meetupPlan.subjects.size > 0) {
    const presentSlots = new Map<string, Map<string, Set<number>>>();
    for (const a of attendance) {
      if (!a.subjectId || a.status !== "present") continue;
      let byDate = presentSlots.get(a.subjectId);
      if (!byDate) {
        byDate = new Map();
        presentSlots.set(a.subjectId, byDate);
      }
      const dateKey = a.date.toISOString().slice(0, 10);
      let slots = byDate.get(dateKey);
      if (!slots) {
        slots = new Set();
        byDate.set(dateKey, slots);
      }
      slots.add(a.slot);
    }
    const enlistStr = section.learnerStart
      ? section.learnerStart.toISOString().slice(0, 10)
      : null;
    for (const subjectId of meetupPlan.subjects.keys()) {
      const scheduled = meetupPlan.scheduledCountBySubjectDate.get(subjectId);
      const counts =
        scheduled && scheduled.size > 0
          ? scheduled
          : meetupPlan.recordedCountBySubjectDate.get(subjectId);
      if (!counts) continue;
      for (const [date, count] of counts) {
        if (enlistStr && date <= enlistStr) continue;
        meetupTotal += count;
        meetupPresent += Math.min(count, presentSlots.get(subjectId)?.get(date)?.size ?? 0);
      }
    }
  }
  const metered = meetupTotal > 0;
  const rate = metered
    ? meetupPresent / meetupTotal
    : attendance.length > 0
      ? present / attendance.length
      : null;

  const raws = grades
    .map((g) => g.computedAverage)
    .filter((v): v is number => typeof v === "number");
  const rawAverage =
    raws.length > 0 ? raws.reduce((s, v) => s + v, 0) / raws.length : null;

  const transmutes = grades
    .map((g) => g.transmutedGrade)
    .filter((v): v is number => typeof v === "number");
  const transmutedAverage =
    transmutes.length > 0
      ? transmutes.reduce((s, v) => s + v, 0) / transmutes.length
      : null;

  const bySubjectMap = new Map<
    string,
    { code: string; name: string; present: number; total: number }
  >();
  let generalPresent = 0;
  let generalTotal = 0;
  for (const a of attendance) {
    if (!a.subjectId) {
      generalTotal += 1;
      if (a.status === "present") generalPresent += 1;
      continue;
    }
    const key = a.subjectId;
    const entry = bySubjectMap.get(key) ?? {
      code: a.subject?.code ?? "",
      name: a.subject?.name ?? "Subject",
      present: 0,
      total: 0,
    };
    entry.total += 1;
    if (a.status === "present") entry.present += 1;
    bySubjectMap.set(key, entry);
  }
  const bySubject = [...bySubjectMap.values()]
    .map((s) => ({
      ...s,
      rate: s.total > 0 ? s.present / s.total : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Self-heal stale snapshots: when the live engine disagrees with the stored
  // snapshot (e.g. after a rule fix), persist the fresh result in the
  // background so "Stored now" converges without waiting for the sweep.
  if (!snapshot || snapshot.riskLevel !== live.result.riskLevel) {
    void (studentId
      ? recomputeRisk(studentId, termId)
      : recomputeRosterRisk(rosterId!, termId)
    ).catch(() => undefined);
  }

  return {
    live: {
      level: live.result.riskLevel,
      count: live.result.riskCount,
      academic: live.academicFlag,
      attendance: live.attendanceFlag,
      behavioral: live.behavioralFlag,
    },
    academic: {
      average: rawAverage,
      transmutedAverage,
      subjectCount: grades.length,
      threshold: 75,
      subjects: grades.map((g) => ({
        code: g.subject?.code ?? "",
        name: g.subject?.name ?? "Subject",
        computedAverage: g.computedAverage,
        transmutedGrade: g.transmutedGrade,
        below: (g.transmutedGrade ?? g.computedAverage ?? 100) < 75,
      })),
    },
    attendance: {
      rate,
      present: metered ? meetupPresent : present,
      total: metered ? meetupTotal : attendance.length,
      subjectEra,
      threshold: 0.8,
      bySubject,
      general:
        generalTotal > 0
          ? {
              present: generalPresent,
              total: generalTotal,
              rate: generalPresent / generalTotal,
            }
          : null,
    },
    behavioral: {
      count: anecdotals.length,
      recent: anecdotals.map((a) => ({
        category: a.category,
        date: a.observationDatetime.toISOString().slice(0, 10),
      })),
    },
    stored: snapshot
      ? {
          level: snapshot.riskLevel,
          count: snapshot.riskCount,
          date: snapshot.snapshotDate.toISOString().slice(0, 10),
        }
      : null,
    flagged: flagged ? { level: flagged.riskLevelAtFlag } : null,
  };
}
