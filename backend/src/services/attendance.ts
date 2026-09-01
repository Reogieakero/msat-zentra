import { prisma } from "../lib/prisma.js";

/**
 * Instruction days elapsed: weekdays (Mon–Fri) from the term start date
 * through today. Weekends are excluded so the denominator reflects actual
 * school days, not every calendar day. Use this as the single source of
 * truth for "school days done" across attendance surfaces.
 */
export function schoolDaysToDate(termStartDate: Date | string | null | undefined): number {
  const start = termStartDate
    ? new Date(new Date(termStartDate).toISOString().slice(0, 10) + "T00:00:00Z")
    : null;
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const axisStart = start ?? today;
  let total = 0;
  for (let d = new Date(axisStart); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) total += 1;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Generic attendance engine — the single source of truth for every attendance
// surface (section heatblocks, section stats, student rosters, session
// pattern). All metrics below derive from one canonical definition:
//
//   - present count   = number of "present" records for a section + session + day
//   - present ratio   = present ÷ headcount (the section's or grade's enrolled)
//   - attendance %    = average present per school day ÷ headcount
//   - school days     = weekdays (Mon–Fri) from term start through today
//
// Endpoints must consume these helpers instead of re-deriving their own math so
// the heatmap coloring, the trend line, and the table/alerts can never drift.
// ---------------------------------------------------------------------------

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface DayAgg {
  present: number;
  late: number;
  excused: number;
  /** Records actually submitted for that day/section/session (may be < headcount). */
  total: number;
}

/** Continuous UTC date axis from term start (or the given date) through today. */
export function buildDayAxis(start: Date | string | null | undefined): string[] {
  const startD = start
    ? new Date(new Date(start).toISOString().slice(0, 10) + "T00:00:00Z")
    : null;
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const axisStart = startD ?? today;
  const keys: string[] = [];
  for (let d = new Date(axisStart); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

/** Format a UTC date key (YYYY-MM-DD) for display. */
export function formatDateKey(key: string): string {
  const d = new Date(key + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Count weekdays (Mon–Fri) among the given date keys. */
export function countSchoolDays(keys: string[]): number {
  return keys.reduce((acc, key) => {
    const wd = new Date(key + "T00:00:00Z").getUTCDay();
    return wd !== 0 && wd !== 6 ? acc + 1 : acc;
  }, 0);
}

export function isWeekendKey(key: string): boolean {
  const wd = new Date(key + "T00:00:00Z").getUTCDay();
  return wd === 0 || wd === 6;
}

/** Aggregate raw attendance records into per-section per-day status counts. */
export function groupSectionDay(
  records: { sectionId: string; date: Date; status: AttendanceStatus }[]
): Record<string, Map<string, DayAgg>> {
  const map: Record<string, Map<string, DayAgg>> = {};
  for (const r of records) {
    const key = r.date.toISOString().slice(0, 10);
    if (!map[r.sectionId]) map[r.sectionId] = new Map();
    if (!map[r.sectionId].has(key)) {
      map[r.sectionId].set(key, { present: 0, late: 0, excused: 0, total: 0 });
    }
    const cell = map[r.sectionId].get(key)!;
    cell.total += 1;
    if (r.status === "present") cell.present++;
    else if (r.status === "late") cell.late++;
    else if (r.status === "excused") cell.excused++;
  }
  return map;
}

/** Daily present ratio as a percentage (0..100) at the given headcount. */
export function dailyPresentPercent(present: number, headcount: number): number {
  if (headcount <= 0 || present <= 0) return 0;
  return Math.round((present / headcount) * 1000) / 10;
}

/**
 * Attendance percentage — average present per school day ÷ headcount.
 * Denominator = headcount × schoolDays, exactly matching the canonical
 * "average present of the session per day divided by total headcount".
 */
export function avgPresentPercent(
  days: DayAgg[],
  headcount: number,
  schoolDays: number
): number {
  if (headcount <= 0 || schoolDays <= 0) return 0;
  let present = 0;
  for (const d of days) present += d.present;
  return Math.round((present / (headcount * schoolDays)) * 1000) / 10;
}

/** Days (with submitted records) whose present ratio is below the 80% mark. */
export function below80Days(days: DayAgg[], headcount: number): number {
  if (headcount <= 0) return 0;
  return days.filter((d) => d.total > 0 && d.present / headcount < 0.8).length;
}

/** Trend: compare avg present % (÷ headcount) across the first vs second half. */
export function attendanceTrend(
  days: DayAgg[],
  headcount: number
): "up" | "down" | "flat" {
  if (headcount <= 0 || days.length < 2) return "flat";
  const half = Math.floor(days.length / 2);
  const avg = (arr: DayAgg[]) => {
    if (arr.length === 0) return 0;
    let p = 0;
    for (const d of arr) p += d.present;
    return p / (headcount * arr.length);
  };
  const diff = avg(days.slice(half)) - avg(days.slice(0, half));
  if (diff > 0.015) return "up";
  if (diff < -0.015) return "down";
  return "flat";
}

export interface AttendanceRate {
  rate: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  isRisk: boolean;
}

// PLAN.md §6.2 — rate over AM/PM sessions in a term.
export async function computeAttendanceRate(
  studentId: string,
  termId: string
): Promise<AttendanceRate> {
  const records = await prisma.attendanceRecord.findMany({
    where: { studentId, termId },
    select: { status: true },
  });
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const r of records) counts[r.status]++;
  const total = records.length;
  const rate = total === 0 ? 1 : counts.present / total;
  return {
    ...counts,
    total,
    rate,
    isRisk: rate < 0.8,
  };
}
