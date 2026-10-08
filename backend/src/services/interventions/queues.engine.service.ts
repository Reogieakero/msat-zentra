import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { evaluateRisk, evaluateRosterRisk } from "../risk.js";

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
  const [grades, attendance, anecdotals, snapshot, flagged] = await Promise.all([
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
        subject: { select: { name: true, code: true } },
      },
    }),
    prisma.anecdotalRecord.findMany({
      where: studentId ? { studentId, termId } : { rosterId: rosterId!, termId },
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
  ]);

  const present = attendance.filter((a) => a.status === "present").length;
  const subjectEra = attendance.some((a) => a.subjectId !== null);
  const rate = attendance.length > 0 ? present / attendance.length : null;

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
      present,
      total: attendance.length,
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
