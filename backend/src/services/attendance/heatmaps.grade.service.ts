import { prisma } from "../../lib/prisma.js";
import { rosterCountsByGrade } from "../enrollment.js";
import { phTodayKey } from "../attendance.js";
import type { GradeLevel } from "../../generated/prisma/client.js";
import { GRADE_LABEL, GRADE_ORDER } from "../../modules/attendance/attendance.repository.js";

export type HeatSession = "AM" | "PM";

export interface HeatmapQuery {
  session: HeatSession;
  statusFilter: "present" | "late" | "absent" | "excused";
  termId?: string;
  startDate?: Date | null;
}

export async function getHeatmap(query: HeatmapQuery) {
  const { session, statusFilter, termId, startDate } = query;
  const where = { session, ...(termId ? { termId } : {}) };

  const records = await prisma.attendanceRecord.findMany({
    where,
    select: {
      date: true,
      status: true,
      student: { select: { gradeLevel: true } },
      roster: { select: { gradeLevel: true } },
    },
    orderBy: { date: "asc" },
  });

  const enrolledByGrade: Record<string, number> = {};
  const [enrollCounts, rosterByGrade] = await Promise.all([
    prisma.studentProfile.groupBy({
      by: ["gradeLevel"],
      _count: { _all: true },
    }),
    rosterCountsByGrade([...GRADE_ORDER] as GradeLevel[]),
  ]);
  for (const e of enrollCounts) enrolledByGrade[e.gradeLevel] = e._count._all;
  for (const [gl, n] of rosterByGrade) enrolledByGrade[gl] = (enrolledByGrade[gl] ?? 0) + n;

  const start = startDate
    ? new Date(startDate.toISOString().slice(0, 10) + "T00:00:00Z")
    : null;
  const today = new Date(phTodayKey() + "T00:00:00Z");
  const axisStart = start ?? records[0]?.date ?? today;
  const dayKeys: string[] = [];
  for (let d = new Date(axisStart); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    dayKeys.push(d.toISOString().slice(0, 10));
  }

  const gradeDayStatus: Record<string, Map<string, { present: number; late: number; excused: number }>> = {};
  for (const r of records) {

    const grade = r.student?.gradeLevel ?? r.roster?.gradeLevel;
    if (!grade) continue;
    const key = r.date.toISOString().slice(0, 10);
    if (!gradeDayStatus[grade]) gradeDayStatus[grade] = new Map();
    if (!gradeDayStatus[grade].has(key)) {
      gradeDayStatus[grade].set(key, { present: 0, late: 0, excused: 0 });
    }
    const cell = gradeDayStatus[grade].get(key)!;
    if (r.status === "present") cell.present++;
    else if (r.status === "late") cell.late++;
    else if (r.status === "excused") cell.excused++;
  }

  const grades = GRADE_ORDER.map((grade) => {
    const statusMap = gradeDayStatus[grade] ?? new Map<string, { present: number; late: number; excused: number }>();
    const total = enrolledByGrade[grade] ?? 0;
    return {
      grade: GRADE_LABEL[grade],
      enrolled: total,
      days: dayKeys.map((key) => {
        const cell = statusMap.get(key) ?? { present: 0, late: 0, excused: 0 };

        const accounted = cell.present + cell.late + cell.excused;
        const absent = Math.max(0, total - accounted);
        const d = new Date(key + "T00:00:00Z");
        const date = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        });
        return { date, present: cell.present, late: cell.late, absent, excused: cell.excused, total };
      }),
    };
  });

  return { session, status: statusFilter, grades };
}

export interface SummaryQuery {
  session?: HeatSession;
  termId?: string;
}

export async function getSummary(query: SummaryQuery) {
  const { session, termId } = query;

  const today = new Date(phTodayKey() + "T00:00:00Z");
  const dayKeys: string[] = [];
  for (let d = new Date(today); dayKeys.length < 5; d.setUTCDate(d.getUTCDate() - 1)) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) dayKeys.push(d.toISOString().slice(0, 10));
  }
  dayKeys.reverse();

  const where = {
    ...(termId ? { termId } : {}),
    ...(session ? { session } : {}),
    date: { gte: new Date(dayKeys[0] + "T00:00:00Z") },
  };

  const records = await prisma.attendanceRecord.findMany({
    where,
    select: {
      date: true,
      status: true,
      student: { select: { gradeLevel: true } },
      roster: { select: { gradeLevel: true } },
    },
  });

  const byDay = new Map<string, { present: number; total: number }>();
  const gradeDayAgg: Record<string, Map<string, { present: number; total: number }>> = {};
  const gradeTermAgg: Record<string, { present: number; total: number }> = {};
  for (const r of records) {
    const key = r.date.toISOString().slice(0, 10);

    if (!byDay.has(key)) byDay.set(key, { present: 0, total: 0 });
    const agg = byDay.get(key)!;
    agg.total += 1;
    if (r.status === "present") agg.present += 1;

    const grade = r.student?.gradeLevel ?? r.roster?.gradeLevel;
    if (!grade) continue;
    if (!gradeDayAgg[grade]) gradeDayAgg[grade] = new Map();
    if (!gradeDayAgg[grade].has(key)) gradeDayAgg[grade].set(key, { present: 0, total: 0 });
    const gAgg = gradeDayAgg[grade].get(key)!;
    gAgg.total += 1;
    if (r.status === "present") gAgg.present += 1;

    if (!gradeTermAgg[grade]) gradeTermAgg[grade] = { present: 0, total: 0 };
    gradeTermAgg[grade].total += 1;
    if (r.status === "present") gradeTermAgg[grade].present += 1;
  }

  const trend = dayKeys.map((key) => {
    const agg = byDay.get(key) ?? { present: 0, total: 0 };
    const d = new Date(key + "T00:00:00Z");
    const day = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    return { day, present: agg.present, total: agg.total };
  });

  const grades = GRADE_ORDER.filter((g) => gradeTermAgg[g]).map((g) => ({
    grade: GRADE_LABEL[g],
    present: gradeTermAgg[g].present,
    total: gradeTermAgg[g].total,
    days: dayKeys.map((key) => {
      const agg = gradeDayAgg[g]?.get(key) ?? { present: 0, total: 0 };
      const d = new Date(key + "T00:00:00Z");
      const day = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
      return { day, present: agg.present, total: agg.total };
    }),
  }));

  return { session: session ?? "ALL", trend, grades };
}
