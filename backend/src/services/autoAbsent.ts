import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/pino.js";
import { invalidateTags } from "../lib/cache.js";
import { recomputeRisk, recomputeRosterRisk } from "./risk.js";

const RECORDED_BY = "system:auto-absent";
const LOOKBACK_DAYS = 14;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`).getTime() + n * 86_400_000;
  return new Date(d).toISOString().slice(0, 10);
}

export async function sweepAutoAbsent(
  now = new Date()
): Promise<{ meetups: number; rows: number }> {
  const todayStr = dayKey(now);
  const yesterdayStr = addDays(todayStr, -1);
  const earliestStr = addDays(todayStr, -LOOKBACK_DAYS);

  const terms = await prisma.term.findMany({
    where: {
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: new Date(`${earliestStr}T00:00:00Z`) } }],
    },
    select: { id: true, startDate: true, endDate: true },
  });

  let meetups = 0;
  let rows = 0;
  const touchedProfiles = new Map<string, string>();
  const touchedRosters = new Map<string, string>();

  for (const term of terms) {
    if (!term.startDate) continue;
    const startStr = dayKey(term.startDate);
    const winStart = startStr > earliestStr ? startStr : earliestStr;
    if (winStart > yesterdayStr) continue;

    const [entries, taken, profiles, rosters] = await Promise.all([
      prisma.sectionTimetableEntry.findMany({
        where: {
          termId: term.id,
          status: { in: ["APPROVED", "SUBMITTED"] },
        },
        select: { sectionId: true, subjectId: true, day: true, period: true },
      }),
      prisma.attendanceRecord.findMany({
        where: {
          termId: term.id,
          date: {
            gte: new Date(`${winStart}T00:00:00Z`),
            lt: new Date(`${addDays(yesterdayStr, 1)}T00:00:00Z`),
          },
          NOT: { subjectId: null },
        },
        select: { sectionId: true, subjectId: true, date: true, slot: true },
      }),
      prisma.studentProfile.findMany({
        select: { userId: true, sectionId: true },
      }),
      prisma.studentRoster.findMany({
        select: { id: true, sectionId: true },
      }),
    ]);

    const takenSet = new Set(
      taken.map(
        (t) =>
          `${t.sectionId}|${t.subjectId}|${dayKey(t.date)}|${t.slot}`
      )
    );
    const profilesBySection = new Map<string, string[]>();
    for (const p of profiles) {
      if (!p.sectionId) continue;
      const arr = profilesBySection.get(p.sectionId) ?? [];
      arr.push(p.userId);
      profilesBySection.set(p.sectionId, arr);
    }
    const rostersBySection = new Map<string, string[]>();
    for (const r of rosters) {
      if (!r.sectionId) continue;
      const arr = rostersBySection.get(r.sectionId) ?? [];
      arr.push(r.id);
      rostersBySection.set(r.sectionId, arr);
    }

    const missing: {
      sectionId: string;
      subjectId: string;
      date: Date;
      slot: number;
    }[] = [];
    for (const e of entries) {
      for (let d = winStart; d <= yesterdayStr; d = addDays(d, 1)) {
        const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
        const day = dow === 0 ? 7 : dow;
        if (day !== e.day) continue;
        const slot = e.period + 1;
        if (takenSet.has(`${e.sectionId}|${e.subjectId}|${d}|${slot}`)) continue;
        missing.push({
          sectionId: e.sectionId,
          subjectId: e.subjectId,
          date: new Date(`${d}T00:00:00Z`),
          slot,
        });
      }
    }
    if (missing.length === 0) continue;

    const inputs: {
      studentId: string | null;
      rosterId: string | null;
      sectionId: string;
      date: Date;
      session: "AM";
      status: "absent";
      recordedBy: string;
      termId: string;
      subjectId: string;
      slot: number;
    }[] = [];
    for (const m of missing) {
      for (const studentId of profilesBySection.get(m.sectionId) ?? []) {
        inputs.push({
          studentId,
          rosterId: null,
          sectionId: m.sectionId,
          date: m.date,
          session: "AM",
          status: "absent",
          recordedBy: RECORDED_BY,
          termId: term.id,
          subjectId: m.subjectId,
          slot: m.slot,
        });
        if (!touchedProfiles.has(studentId)) touchedProfiles.set(studentId, term.id);
      }
      for (const rosterId of rostersBySection.get(m.sectionId) ?? []) {
        inputs.push({
          studentId: null,
          rosterId,
          sectionId: m.sectionId,
          date: m.date,
          session: "AM",
          status: "absent",
          recordedBy: RECORDED_BY,
          termId: term.id,
          subjectId: m.subjectId,
          slot: m.slot,
        });
        if (!touchedRosters.has(rosterId)) touchedRosters.set(rosterId, term.id);
      }
    }
    if (inputs.length === 0) continue;

    const created = await prisma.attendanceRecord.createMany({
      data: inputs,
      skipDuplicates: true,
    });
    meetups += missing.length;
    rows += created.count;
  }

  for (const [studentId, termId] of touchedProfiles) {
    try {
      await recomputeRisk(studentId, termId);
    } catch (err) {
      logger.warn({ err, studentId }, "auto-absent recompute failed");
    }
  }
  for (const [rosterId, termId] of touchedRosters) {
    try {
      await recomputeRosterRisk(rosterId, termId);
    } catch (err) {
      logger.warn({ err, rosterId }, "auto-absent roster recompute failed");
    }
  }

  if (rows > 0) {
    await invalidateTags(["teacher", "risk", "guidance", "overview", "alerts"]);
  }
  logger.info({ meetups, rows }, "Auto-absent sweep complete");
  return { meetups, rows };
}
