const PH_OFFSET_MS = 8 * 3_600_000;

export function phTodayKey(now: Date = new Date()): string {
  return new Date(now.getTime() + PH_OFFSET_MS).toISOString().slice(0, 10);
}

export function manilaKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function dayKeyOf(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Day range for an axis: term start → min(Manila today, term end).
 *
 * The term end matters for a past term: without it the axis would keep
 * counting to today and inflate denominators (school days, "no record"
 * columns) for a term that already ended. A future term yields no days, and
 * a missing start anchors on today (the historical behaviour).
 */
function dayBounds(
  start: Date | string | null | undefined,
  end?: Date | string | null,
): { from: string; to: string } | null {
  const todayKey = phTodayKey();
  const from = dayKeyOf(start) ?? todayKey;
  const endKey = dayKeyOf(end);
  const to = endKey && endKey < todayKey ? endKey : todayKey;
  return from > to ? null : { from, to };
}

export function schoolDaysToDate(
  termStartDate: Date | string | null | undefined,
  termEndDate?: Date | string | null,
): number {
  const bounds = dayBounds(termStartDate, termEndDate);
  if (!bounds) return 0;
  return countSchoolDays(buildDayAxis(termStartDate, termEndDate));
}

export function buildDayAxis(
  start: Date | string | null | undefined,
  end?: Date | string | null,
): string[] {
  const bounds = dayBounds(start, end);
  if (!bounds) return [];
  const keys: string[] = [];
  const last = new Date(bounds.to + "T00:00:00Z");
  for (
    let d = new Date(bounds.from + "T00:00:00Z");
    d <= last;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

export function formatDateKey(key: string): string {
  const d = new Date(key + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function buildSchoolDayAxis(
  start: Date | string | null | undefined,
  end?: Date | string | null,
): string[] {
  return buildDayAxis(start, end).filter((key) => !isWeekendKey(key));
}

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

/**
 * True once the term's start date has been reached (Manila calendar). A term
 * that has not started yet is outside its scope period: dashboards must treat
 * its grades/attendance/anecdotes as empty rather than surfacing rows that may
 * have been seeded or staged ahead of time.
 */
export function termHasStarted(
  termStartDate: Date | string | null | undefined,
): boolean {
  const startKey = dayKeyOf(termStartDate);
  return startKey === null || startKey <= phTodayKey();
}
