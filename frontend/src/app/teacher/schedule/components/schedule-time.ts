// School-day shape for the master-teacher setup timetable. Everything flows
// sequentially from the class start time: 8 subject periods with a lunch row
// after one of them and optional recess rows after theirs. Clock times are
// derived — the table re-renders from whatever is configured here. When a
// recess shares its period with lunch, lunch renders first.

export interface RecessConfig {
  enabled: boolean;
  /** 1-based period the recess follows (1–4 morning, 5–8 afternoon). */
  afterPeriod: number;
  /** Break length in minutes. */
  mins: number;
}

export interface LunchConfig {
  /** 1-based period lunch follows (1–8). */
  afterPeriod: number;
  /** Lunch length in minutes. */
  mins: number;
}

export interface DayConfig {
  /** "HH:MM" 24h — real start of classes. */
  startTime: string;
  /** Minutes per subject period. */
  periodMins: number;
  lunch: LunchConfig;
  morningRecess: RecessConfig;
  afternoonRecess: RecessConfig;
}

export const DEFAULT_DAY_CONFIG: DayConfig = {
  startTime: "07:30",
  periodMins: 60,
  lunch: { afterPeriod: 4, mins: 90 },
  morningRecess: { enabled: false, afterPeriod: 2, mins: 15 },
  afternoonRecess: { enabled: false, afterPeriod: 6, mins: 15 },
};

export type TimetableRow =
  | { kind: "period"; periodIndex: number; startMin: number; endMin: number }
  | { kind: "recess"; label: string; startMin: number; endMin: number }
  | { kind: "lunch"; startMin: number; endMin: number };

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function buildTimetable(config: DayConfig): TimetableRow[] {
  let t = toMinutes(config.startTime);
  const rows: TimetableRow[] = [];
  for (let i = 1; i <= 8; i += 1) {
    rows.push({ kind: "period", periodIndex: i - 1, startMin: t, endMin: t + config.periodMins });
    t += config.periodMins;
    if (config.lunch.afterPeriod === i) {
      rows.push({ kind: "lunch", startMin: t, endMin: t + config.lunch.mins });
      t += config.lunch.mins;
    } else if (config.morningRecess.enabled && config.morningRecess.afterPeriod === i) {
      rows.push({
        kind: "recess",
        label: "Morning Recess",
        startMin: t,
        endMin: t + config.morningRecess.mins,
      });
      t += config.morningRecess.mins;
    } else if (config.afternoonRecess.enabled && config.afternoonRecess.afterPeriod === i) {
      rows.push({
        kind: "recess",
        label: "Afternoon Recess",
        startMin: t,
        endMin: t + config.afternoonRecess.mins,
      });
      t += config.afternoonRecess.mins;
    }
  }
  return rows;
}

export function formatClock(totalMin: number): string {
  const h24 = ((Math.floor(totalMin / 60) % 24) + 24) % 24;
  const m = ((totalMin % 60) + 60) % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function formatRange(startMin: number, endMin: number): string {
  return `${formatClock(startMin)} – ${formatClock(endMin)}`;
}
