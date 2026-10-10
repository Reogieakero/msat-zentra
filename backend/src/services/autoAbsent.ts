import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/pino.js";
import { invalidateTags } from "../lib/cache.js";
import { recomputeRisk, recomputeRosterRisk } from "./risk.js";
import {
  SCHEDULE_CONFIG_DEFAULTS,
  toScheduleConfig,
} from "../modules/teacher/teacher.labels.js";

const RECORDED_BY = "system:auto-absent";
const LOOKBACK_DAYS = 14;

type ScheduleLike = {
  startTime: string;
  periodMins: number;
  lunch: { afterPeriod: number; mins: number };
  morningRecess: { enabled: boolean; afterPeriod: number; mins: number };
  afternoonRecess: { enabled: boolean; afterPeriod: number; mins: number };
};

// Mirror of the frontend buildTimetable(): end minute of a 0-based period.
function periodEndMinutes(cfg: ScheduleLike, period: number): number {
  const [h, m] = cfg.startTime.split(":").map(Number);
  let t = (h || 0) * 60 + (m || 0);
  for (let i = 1; i <= 8; i++) {
    const end = t + cfg.periodMins;
    if (i - 1 === period) return end;
    t = end;
    if (cfg.lunch.afterPeriod === i) t += cfg.lunch.mins;
    else if (cfg.morningRecess.enabled && cfg.morningRecess.afterPeriod === i) t += cfg.morningRecess.mins;
    else if (cfg.afternoonRecess.enabled && cfg.afternoonRecess.afterPeriod === i) t += cfg.afternoonRecess.mins;
  }
  return t;
}

function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`).getTime() + n * 86_400_000;
  return new Date(d).toISOString().slice(0, 10);
}

// Philippine wall-clock parts (school timezone).
function phParts(now: Date): { key: string; min: number; dow: number } {
  const ph = new Date(now.getTime() + 8 * 3_600_000);
  const dow0 = ph.getUTCDay();
  return {
    key: ph.toISOString().slice(0, 10),
    min: ph.getUTCHours() * 60 + ph.getUTCMinutes(),
    dow: dow0 === 0 ? 7 : dow0,
  };
}

export async function sweepAutoAbsent(
  now = new Date()
): Promise<{ meetups: number; rows: number }> {
  // Rule: no record + subject time done = absent. Covers whole missing sheets
  // AND unmarked students on partially saved sheets, for past days and for
  // today's already-elapsed periods. Runs hourly + on demand.
  const ph = phParts(now);
  const todayStr = ph.key;
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

  const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

  for (const term of terms) {
    if (!term.startDate) continue;
    const startStr = dayKey(term.startDate);
    const winStart = startStr > earliestStr ? startStr : earliestStr;
    if (winStart > todayStr) continue;
    const termEndStr = term.endDate ? dayKey(term.endDate) : null;
    const winEnd = termEndStr && termEndStr < todayStr ? termEndStr : todayStr;
    if (winStart > winEnd) continue;

    const cfgRow = await prisma.scheduleConfig.findUnique({ where: { termId: term.id } });
    const cfg: ScheduleLike = cfgRow ? toScheduleConfig(cfgRow) : SCHEDULE_CONFIG_DEFAULTS;

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
            lt: new Date(`${addDays(winEnd, 1)}T00:00:00Z`),
          },
          NOT: { subjectId: null },
        },
        select: { sectionId: true, subjectId: true, date: true, slot: true, studentId: true, rosterId: true },
      }),
      prisma.studentProfile.findMany({
        select: { userId: true, sectionId: true },
      }),
      prisma.studentRoster.findMany({
        select: { id: true, sectionId: true },
      }),
    ]);

    // Sheets already taken (any writer, incl. teachers) + who is on each sheet.
    const takenSheets = new Set<string>();
    const takenStudents = new Map<string, Set<string>>();
    for (const t of taken) {
      if (!t.subjectId) continue;
      const key = `${t.sectionId}|${t.subjectId}|${dayKey(t.date)}|${t.slot}`;
      takenSheets.add(key);
      const who = t.studentId ?? (t.rosterId ? `roster:${t.rosterId}` : null);
      if (!who) continue;
      const set = takenStudents.get(key) ?? new Set<string>();
      set.add(who);
      takenStudents.set(key, set);
    }
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
    // Taken sheets whose unmarked students still need absent backfill.
    const backfill: {
      sectionId: string;
      subjectId: string;
      date: Date;
      slot: number;
      have: Set<string>;
    }[] = [];
    for (const e of entries) {
      const slot = e.period + 1;
      for (let d = winStart; d <= winEnd; d = addDays(d, 1)) {
        const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
        const day = dow === 0 ? 7 : dow;
        if (day !== e.day) continue;
        // Subject time done? Past days: whole day. Today: period must have ended.
        if (d === todayStr && periodEndMinutes(cfg, e.period) > ph.min) continue;
        const key = `${e.sectionId}|${e.subjectId}|${d}|${slot}`;
        if (!takenSheets.has(key)) {
          missing.push({
            sectionId: e.sectionId,
            subjectId: e.subjectId,
            date: new Date(`${d}T00:00:00Z`),
            slot,
          });
        } else {
          backfill.push({
            sectionId: e.sectionId,
            subjectId: e.subjectId,
            date: new Date(`${d}T00:00:00Z`),
            slot,
            have: takenStudents.get(key) ?? new Set<string>(),
          });
        }
      }
    }
    if (missing.length === 0 && backfill.length === 0) continue;

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
    // Partially saved sheets: students with no record on an elapsed meetup
    // are absent too.
    for (const b of backfill) {
      for (const studentId of profilesBySection.get(b.sectionId) ?? []) {
        if (b.have.has(studentId)) continue;
        inputs.push({
          studentId,
          rosterId: null,
          sectionId: b.sectionId,
          date: b.date,
          session: "AM",
          status: "absent",
          recordedBy: RECORDED_BY,
          termId: term.id,
          subjectId: b.subjectId,
          slot: b.slot,
        });
        if (!touchedProfiles.has(studentId)) touchedProfiles.set(studentId, term.id);
      }
      for (const rosterId of rostersBySection.get(b.sectionId) ?? []) {
        if (b.have.has(`roster:${rosterId}`)) continue;
        inputs.push({
          studentId: null,
          rosterId,
          sectionId: b.sectionId,
          date: b.date,
          session: "AM",
          status: "absent",
          recordedBy: RECORDED_BY,
          termId: term.id,
          subjectId: b.subjectId,
          slot: b.slot,
        });
        if (!touchedRosters.has(rosterId)) touchedRosters.set(rosterId, term.id);
      }
    }
    if (inputs.length === 0) continue;

    // Chunked: a full 14-day backfill can be tens of thousands of rows.
    let createdCount = 0;
    for (let i = 0; i < inputs.length; i += 500) {
      const created = await prisma.attendanceRecord.createMany({
        data: inputs.slice(i, i + 500),
        skipDuplicates: true,
      });
      createdCount += created.count;
    }
    meetups += missing.length + backfill.length;
    rows += createdCount;
  }

  // Bounded concurrency: hundreds of students × sequential recomputes stall
  // the hourly job for minutes (the hourly risk-refresh covers stragglers).
  async function settleInBatches<T>(items: T[], fn: (item: T) => Promise<unknown>) {
    for (let i = 0; i < items.length; i += 10) {
      await Promise.all(
        items.slice(i, i + 10).map((item) =>
          fn(item).catch((err) => logger.warn({ err }, "auto-absent recompute failed")),
        ),
      );
    }
  }
  await settleInBatches([...touchedProfiles], ([studentId, termId]) => recomputeRisk(studentId, termId));
  await settleInBatches([...touchedRosters], ([rosterId, termId]) => recomputeRosterRisk(rosterId, termId));

  if (rows > 0) {
    await invalidateTags(["teacher", "risk", "guidance", "overview", "alerts"]);
  }
  logger.info({ meetups, rows }, "Auto-absent sweep complete");
  return { meetups, rows };
}
