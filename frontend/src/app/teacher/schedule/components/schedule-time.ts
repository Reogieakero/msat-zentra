export interface RecessConfig {
  enabled: boolean;
  afterPeriod: number;
  mins: number;
}

export interface LunchConfig {
  afterPeriod: number;
  mins: number;
}

export interface DayConfig {
  startTime: string;
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
