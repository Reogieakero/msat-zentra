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

export function formatDateKey(key: string): string {
  const d = new Date(key + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function buildSchoolDayAxis(start: Date | string | null | undefined): string[] {
  return buildDayAxis(start).filter((key) => !isWeekendKey(key));
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
