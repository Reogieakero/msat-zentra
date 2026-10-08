import { isWeekendKey } from "./attendance.date.utils.js";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface DayAgg {
  present: number;
  late: number;
  excused: number;

  total: number;
}

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

export function dailyPresentPercent(present: number, headcount: number): number {
  if (headcount <= 0 || present <= 0) return 0;
  return Math.round((present / headcount) * 1000) / 10;
}

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

export function below80Days(days: DayAgg[], headcount: number): number {
  if (headcount <= 0) return 0;
  return days.filter((d) => d.total > 0 && d.present / headcount < 0.8).length;
}

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

export interface SubjectDayAgg {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

export function groupSubjectDay(
  records: { subjectId: string | null; date: Date; status: AttendanceStatus }[]
): Map<string, Map<string, SubjectDayAgg>> {
  const map = new Map<string, Map<string, SubjectDayAgg>>();
  for (const r of records) {
    if (!r.subjectId) continue;
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

export function subjectRate(records: { status: AttendanceStatus }[]): number {
  if (records.length === 0) return 1;
  const present = records.filter((r) => r.status === "present").length;
  return present / records.length;
}

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
    else cell.absent++;
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

export interface SectionSubjectTake {
  sectionId: string;

  studentKey: string;
  subjectId: string;
  date: Date;
  status: AttendanceStatus;
}

export type StudentDayOutcome = "present" | "late" | "excused" | "absent";

export interface SectionStrictDay {

  present: Set<string>;

  late: Set<string>;

  excused: Set<string>;

  taken: Set<string>;
}

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

        }
      }
      out.set(key, day);
    }
  }
  return result;
}

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
