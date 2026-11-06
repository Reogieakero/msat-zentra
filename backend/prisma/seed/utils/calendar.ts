import { HOLIDAYS } from "../config.js";

export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isSchoolDay(d: Date): boolean {
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !HOLIDAYS.has(dayKey(d));
}

/** All school days (UTC midnight) between start/end inclusive, capped by cap. */
export function schoolDaysBetween(start: Date, end: Date, cap?: Date): Date[] {
  const out: Date[] = [];
  const s = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const e0 = cap && cap < end ? cap : end;
  const e = new Date(Date.UTC(e0.getUTCFullYear(), e0.getUTCMonth(), e0.getUTCDate()));
  for (let t = s.getTime(); t <= e.getTime(); t += 86_400_000) {
    const d = new Date(t);
    if (isSchoolDay(d)) out.push(d);
  }
  return out;
}

/** Random datetime inside term (capped), school-hours biased 07:00-16:00. */
export function inTermDate(
  rng: { next(): number; int(a: number, b: number): number },
  start: Date,
  end: Date,
  cap?: Date,
): Date {
  const s = start.getTime();
  const e = Math.min(end.getTime(), cap ? cap.getTime() : Date.now(), Date.now());
  if (e <= s) return new Date(s);
  const t = s + rng.next() * (e - s);
  const d = new Date(t);
  d.setUTCHours(rng.int(7, 16), rng.int(0, 59), rng.int(0, 59), 0);
  return d;
}

/** Midnight UTC normalization for attendance date keys. */
export function toMidnightUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
