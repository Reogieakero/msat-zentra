import { prisma } from "../lib/prisma.js";

/**
 * School clock: the school operates on Philippine time (UTC+8). "Today" is
 * the Manila calendar day so the current date's block exists from 12:00 AM
 * Manila — never waiting on the UTC midnight boundary.
 */
const PH_OFFSET_MS = 8 * 3_600_000;

export function phTodayKey(now: Date = new Date()): string {
  return new Date(now.getTime() + PH_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Calendar date (YYYY-MM-DD) of an instant in Asia/Manila, regardless of the
 * server's own timezone. Used to match stored term bounds against "today"
 * without server-TZ skew.
 */
export function manilaKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

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
  const today = new Date(phTodayKey() + "T00:00:00Z");
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

/** Continuous date axis from term start (or the given date) through today
 *  (Manila calendar day — the current date's block exists immediately). */
export function buildDayAxis(start: Date | string | null | undefined): string[] {
  const startD = start
    ? new Date(new Date(start).toISOString().slice(0, 10) + "T00:00:00Z")
    : null;
  const today = new Date(phTodayKey() + "T00:00:00Z");
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

/**
 * Strictly weekday-only axis (Mon–Fri) from term start through today.
 * Weekends never produce blocks — including the current date when it falls
 * on a weekend. `countSchoolDays` counts the same set, so denominators match.
 */
export function buildSchoolDayAxis(start: Date | string | null | undefined): string[] {
  return buildDayAxis(start).filter((key) => !isWeekendKey(key));
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

/**
 * Per-subject attendance engine (AM/PM → subject migration).
 *
 * Canonical triple (see audit §13):
 * - subjectRate = present ÷ subjectSessions (per student+subject+term)
 * - dailyRate   = presentDays ÷ schoolDays (a day counts present only when
 *                 every offered subject that day is present — strict, same
 *                 spirit as the old `possible = schoolDays × 2` rule)
 * - overallRate = present ÷ allSubjectSessions (all subjects pooled)
 *
 * Legacy AM/PM helpers above are frozen for archived reads; new surfaces must
 * use the helpers below so subject rows are never counted as school days.
 */

export interface SubjectDayAgg {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

/** Aggregate subject-era records per subject per day. */
export function groupSubjectDay(
  records: { subjectId: string | null; date: Date; status: AttendanceStatus }[]
): Map<string, Map<string, SubjectDayAgg>> {
  const map = new Map<string, Map<string, SubjectDayAgg>>();
  for (const r of records) {
    if (!r.subjectId) continue; // legacy AM/PM row — not a subject session
    const day = r.date.toISOString().slice(0, 10);
    if (!map.has(r.subjectId)) map.set(r.subjectId, new Map());
    const days = map.get(r.subjectId)!;
    if (!days.has(day)) {
      days.set(day, { present: 0, absent: 0, late: 0, excused: 0, total: 0 });
    }
    const cell = days.get(day)!;
    cell.total += 1;
    if (r.status === "present") cell.present++;
    else if (r.status === "absent") cell.absent++;
    else if (r.status === "late") cell.late++;
    else if (r.status === "excused") cell.excused++;
  }
  return map;
}

/** Subject rate for one student+subject: present ÷ subjectSessions (0..1). */
export function subjectRate(records: { status: AttendanceStatus }[]): number {
  if (records.length === 0) return 1;
  const present = records.filter((r) => r.status === "present").length;
  return present / records.length;
}

/**
 * Daily attendance derived from subject marks.
 * A day counts present only when every recorded subject that day is present
 * and the day covers all `expectedSubjectsPerDay` offerings (unrecorded =
 * absent, strict like the old advisory detail). Returns { presentDays, totalDays }.
 */
export function dailyFromSubjects(
  records: { date: Date; status: AttendanceStatus }[],
  expectedSubjectsPerDay: number
): { presentDays: number; totalDays: number } {
  const byDay = new Map<string, { present: number; total: number; absent: number }>();
  for (const r of records) {
    const day = r.date.toISOString().slice(0, 10);
    if (isWeekendKey(day)) continue;
    if (!byDay.has(day)) byDay.set(day, { present: 0, total: 0, absent: 0 });
    const cell = byDay.get(day)!;
    cell.total += 1;
    if (r.status === "present") cell.present++;
    else cell.absent++; // absent + late + excused all break a "present day"
  }
  let presentDays = 0;
  for (const cell of byDay.values()) {
    if (
      cell.absent === 0 &&
      cell.present > 0 &&
      (expectedSubjectsPerDay <= 0 || cell.total >= expectedSubjectsPerDay)
    ) {
      presentDays += 1;
    }
  }
  return { presentDays, totalDays: byDay.size };
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

export interface SubjectAttendanceRate extends AttendanceRate {
  subjectId: string | null;
  /** Daily view derived from subject marks (null when legacy AM/PM rows). */
  dailyPresentDays: number | null;
  dailyTotalDays: number | null;
}

// PLAN.md §6.2 — rate over AM/PM sessions in a term.
//
// NOTE (subject migration): legacy rows pool AM+PM; subject-era rows pool
// subject sessions. Callers needing the split must use
// computeSubjectAttendanceRate below — never divide subject `total` by
// schoolDays.
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

/**
 * Per-subject rate (+ overall when subjectId is null) with the daily view.
 * Roster twin: pass { rosterId } instead of { studentId }.
 */
export async function computeSubjectAttendanceRate(
  who: { studentId: string } | { rosterId: string },
  termId: string,
  subjectId?: string
): Promise<SubjectAttendanceRate> {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      ...who,
      termId,
      ...(subjectId ? { subjectId } : { NOT: { subjectId: null } }),
    },
    select: { status: true, date: true, subjectId: true },
  });
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const r of records) counts[r.status]++;
  const total = records.length;
  const rate = total === 0 ? 1 : counts.present / total;
  // Daily view only makes sense on the pooled (all-subjects) query.
  let dailyPresentDays: number | null = null;
  let dailyTotalDays: number | null = null;
  if (!subjectId && total > 0) {
    const expected = await countOfferedSubjectsFor(who, termId);
    const daily = dailyFromSubjects(records, expected);
    dailyPresentDays = daily.presentDays;
    dailyTotalDays = daily.totalDays;
  }
  return {
    ...counts,
    total,
    rate,
    isRisk: rate < 0.8,
    subjectId: subjectId ?? null,
    dailyPresentDays,
    dailyTotalDays,
  };
}

/** Distinct offered subjects for a student's section+term (assignment-backed). */
async function countOfferedSubjectsFor(
  who: { studentId: string } | { rosterId: string },
  termId: string
): Promise<number> {
  const holder =
    "studentId" in who
      ? await prisma.studentProfile.findUnique({
          where: { userId: who.studentId },
          select: { sectionId: true },
        })
      : await prisma.studentRoster.findUnique({
          where: { id: who.rosterId },
          select: { sectionId: true },
        });
  if (!holder?.sectionId) return 0;
  const offered = await prisma.teacherSubjectAssignment.groupBy({
    by: ["subjectId"],
    where: { sectionId: holder.sectionId, termId },
  });
  return offered.length;
}

// ---------------------------------------------------------------------------
// Strict per-day section attendance (principal canonical basis).
//
// A student counts PRESENT for a section-day only when present in EVERY
// subject offered that weekday. Late / absent / excused / unrecorded all
// break the day. This is a different basis from per-subject attendance
// (per-take present ÷ takes) — the two must never be mixed.
//
// Day-of-week uses the timetable convention (1=Mon..5=Fri); the school-day
// axis never contains weekends, so 0/6 never match an offering.
// ---------------------------------------------------------------------------

export interface SectionSubjectTake {
  sectionId: string;
  /** Profile userId or `roster:<id>` — caller maps roster/profile identity. */
  studentKey: string;
  subjectId: string;
  date: Date;
  status: AttendanceStatus;
}

export type StudentDayOutcome = "present" | "late" | "excused" | "absent";

export interface SectionStrictDay {
  /** Distinct keys strictly present (all required subjects present). */
  present: Set<string>;
  /** Distinct keys with any late take (and not present). */
  late: Set<string>;
  /** Distinct keys with any excused take (and not present/late). */
  excused: Set<string>;
  /** Distinct keys with any take at all (gates below-80% evaluation). */
  taken: Set<string>;
}

/** Timetable offerings: sectionId -> weekday (1=Mon..5=Fri) -> subjectIds. */
export function buildOfferedMap(
  entries: { sectionId: string; subjectId: string; day: number }[]
): Map<string, Map<number, Set<string>>> {
  const map = new Map<string, Map<number, Set<string>>>();
  for (const e of entries) {
    if (!map.has(e.sectionId)) map.set(e.sectionId, new Map());
    const days = map.get(e.sectionId)!;
    if (!days.has(e.day)) days.set(e.day, new Set());
    days.get(e.day)!.add(e.subjectId);
  }
  return map;
}

function weekdayOfKey(key: string): number {
  return new Date(key + "T00:00:00Z").getUTCDay();
}

/**
 * Strict per-day evaluation over subject-era takes. Priority per
 * student-day: present (all required present) > late (any late) >
 * excused (any excused) > absent (everything else, incl. unrecorded).
 * Required subjects = timetable offerings that weekday; when a section
 * has no offerings that day, the distinct recorded subjects that day
 * are required instead; with no takes at all nobody is present.
 */
export function sectionStrictDays(
  takes: SectionSubjectTake[],
  offeredBySectionWeekday: Map<string, Map<number, Set<string>>>
): Map<string, Map<string, SectionStrictDay>> {
  type Take = { subjectId: string; status: AttendanceStatus };
  const bySectionDayStudent = new Map<string, Map<string, Map<string, Take[]>>>();
  for (const t of takes) {
    const key = t.date.toISOString().slice(0, 10);
    if (!bySectionDayStudent.has(t.sectionId))
      bySectionDayStudent.set(t.sectionId, new Map());
    const days = bySectionDayStudent.get(t.sectionId)!;
    if (!days.has(key)) days.set(key, new Map());
    const students = days.get(key)!;
    if (!students.has(t.studentKey)) students.set(t.studentKey, []);
    students.get(t.studentKey)!.push({ subjectId: t.subjectId, status: t.status });
  }

  const result = new Map<string, Map<string, SectionStrictDay>>();
  for (const [sectionId, days] of bySectionDayStudent) {
    if (!result.has(sectionId)) result.set(sectionId, new Map());
    const out = result.get(sectionId)!;
    for (const [key, students] of days) {
      const required = new Set(
        offeredBySectionWeekday.get(sectionId)?.get(weekdayOfKey(key)) ?? []
      );
      if (required.size === 0) {
        // No timetable offering that weekday — require what was recorded.
        for (const list of students.values())
          for (const t of list) required.add(t.subjectId);
      }
      const day: SectionStrictDay = {
        present: new Set(),
        late: new Set(),
        excused: new Set(),
        taken: new Set(students.keys()),
      };
      if (required.size > 0) {
        for (const [studentKey, list] of students) {
          const bySubject = new Map<string, AttendanceStatus[]>();
          for (const t of list) {
            if (!bySubject.has(t.subjectId)) bySubject.set(t.subjectId, []);
            bySubject.get(t.subjectId)!.push(t.status);
          }
          let allPresent = true;
          for (const sid of required) {
            const marks = bySubject.get(sid);
            if (!marks || marks.length === 0 || marks.some((m) => m !== "present")) {
              allPresent = false;
              break;
            }
          }
          if (allPresent) day.present.add(studentKey);
          else if (list.some((t) => t.status === "late")) day.late.add(studentKey);
          else if (list.some((t) => t.status === "excused")) day.excused.add(studentKey);
          // Else absent (all-absent takes) — counted via complement downstream.
        }
      }
      out.set(key, day);
    }
  }
  return result;
}

/**
 * Per-student day-outcome counts for one section over the given day axis.
 * Every axis day classifies exactly one outcome, so present + late +
 * excused + absent always equals the axis length.
 */
export function studentDayOutcomes(
  sectionDays: Map<string, SectionStrictDay> | undefined,
  studentKeys: string[],
  dayKeys: string[]
): Map<string, { present: number; late: number; excused: number; absent: number }> {
  const result = new Map<
    string,
    { present: number; late: number; excused: number; absent: number }
  >();
  for (const k of studentKeys)
    result.set(k, { present: 0, late: 0, excused: 0, absent: 0 });
  for (const day of dayKeys) {
    const cell = sectionDays?.get(day);
    for (const k of studentKeys) {
      const row = result.get(k)!;
      if (cell?.present.has(k)) row.present++;
      else if (cell?.late.has(k)) row.late++;
      else if (cell?.excused.has(k)) row.excused++;
      else row.absent++;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Subject-average attendance for at-risk flagging (replaces AM/PM sessions).
// General average across all subjects — same definition as the advisory
// attendance display: per subject, present in-window sessions ÷ elapsed
// timetable meetups, averaged across the student's section offerings.
// A done meetup with no take counts as absent. Keys are profile userIds or
// `roster:<id>`.
// ---------------------------------------------------------------------------

export interface SubjectAverageEntry {
  /** Mean of per-subject present rates (0..1). */
  average: number;
  /** True when the student has at least one subject-linked take. Callers
   *  keep the legacy AM/PM result when false. */
  hasSubjectData: boolean;
}

/** Attendance at-risk cutoff — mirrors the risk engine's 80% mark. */
export const ATTENDANCE_RISK_CUTOFF = 0.8;

export async function subjectAverageAttendance(
  sectionIds: string[],
  termId: string
): Promise<Map<string, SubjectAverageEntry>> {
  const empty = new Map<string, SubjectAverageEntry>();
  if (sectionIds.length === 0) return empty;
  const [entries, term, records, profiles, rosters] = await Promise.all([
    prisma.sectionTimetableEntry.findMany({
      where: {
        sectionId: { in: sectionIds },
        termId,
        status: { in: ["APPROVED", "SUBMITTED"] },
      },
      select: { sectionId: true, subjectId: true, day: true },
    }),
    prisma.term.findUnique({
      where: { id: termId },
      select: { startDate: true, endDate: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { sectionId: { in: sectionIds }, termId, NOT: { subjectId: null } },
      select: {
        studentId: true,
        rosterId: true,
        subjectId: true,
        sectionId: true,
        status: true,
        date: true,
      },
    }),
    prisma.studentProfile.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { userId: true, sectionId: true },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { id: true, sectionId: true },
    }),
  ]);

  // Meetup weekdays per section + subject from committed slots.
  const meetups = new Map<string, number[]>();
  for (const e of entries) {
    const k = `${e.sectionId}|${e.subjectId}`;
    const arr = meetups.get(k) ?? [];
    if (!arr.includes(e.day)) arr.push(e.day);
    meetups.set(k, arr);
  }
  // Elapsed meetup dates per section + subject (UTC keys — same window as
  // the advisory matrix, so flags agree with the displayed averages).
  const startStr = term?.startDate?.toISOString().slice(0, 10) ?? null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const endStr = (() => {
    if (!term?.endDate) return todayStr;
    const termEnd = term.endDate.toISOString().slice(0, 10);
    return termEnd < todayStr ? termEnd : todayStr;
  })();
  const elapsed = new Map<string, Set<string>>();
  if (startStr && startStr <= endStr) {
    for (const [k, days] of meetups) {
      const set = new Set<string>();
      for (
        let d = new Date(`${startStr}T00:00:00Z`);
        d.toISOString().slice(0, 10) <= endStr;
        d = new Date(d.getTime() + 86_400_000)
      ) {
        const dow = d.getUTCDay();
        const day = dow === 0 ? 7 : dow;
        if (days.includes(day)) set.add(d.toISOString().slice(0, 10));
      }
      if (set.size > 0) elapsed.set(k, set);
    }
  }
  if (elapsed.size === 0) return empty;

  // Offered subjects per section (only ones with elapsed meetups).
  const offeredBySection = new Map<string, string[]>();
  for (const k of elapsed.keys()) {
    const [sectionId, subjectId] = k.split("|");
    const arr = offeredBySection.get(sectionId) ?? [];
    arr.push(subjectId);
    offeredBySection.set(sectionId, arr);
  }
  const sectionOf = new Map<string, string>();
  for (const p of profiles) sectionOf.set(p.userId, p.sectionId as string);
  for (const r of rosters) sectionOf.set(`roster:${r.id}`, r.sectionId);

  // Distinct present dates per student + subject.
  const present = new Map<string, Set<string>>();
  const touched = new Set<string>();
  for (const r of records) {
    const subjectId = r.subjectId as string;
    const studentKey = r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string);
    touched.add(studentKey);
    if (r.status !== "present") continue;
    const k = `${studentKey}|${r.sectionId}|${subjectId}`;
    let set = present.get(k);
    if (!set) {
      set = new Set();
      present.set(k, set);
    }
    set.add(r.date.toISOString().slice(0, 10));
  }

  const result = new Map<string, SubjectAverageEntry>();
  for (const [studentKey, sectionId] of sectionOf) {
    const offered = offeredBySection.get(sectionId) ?? [];
    if (offered.length === 0) continue;
    let sum = 0;
    for (const subjectId of offered) {
      const dates = elapsed.get(`${sectionId}|${subjectId}`);
      if (!dates || dates.size === 0) continue;
      const presentDates = present.get(`${studentKey}|${sectionId}|${subjectId}`);
      let n = 0;
      for (const d of presentDates ?? []) if (dates.has(d)) n += 1;
      sum += n / dates.size;
    }
    result.set(studentKey, {
      average: sum / offered.length,
      hasSubjectData: touched.has(studentKey),
    });
  }
  return result;
}
