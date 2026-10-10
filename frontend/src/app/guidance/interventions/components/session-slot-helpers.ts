"use client";

export const TIME_SLOTS = [
  { key: "08:00", label: "8:00 AM" },
  { key: "09:00", label: "9:00 AM" },
  { key: "10:30", label: "10:30 AM" },
  { key: "11:00", label: "11:00 AM" },
  { key: "13:00", label: "1:00 PM" },
  { key: "14:00", label: "2:00 PM" },
  { key: "15:00", label: "3:00 PM" },
  { key: "16:00", label: "4:00 PM" },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export interface DayChip {
  key: string;
  dow: string;
  label: string;
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date | null {
  const d = new Date(`${key}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** Next `count` bookable days (skips Sundays), starting tomorrow. */
export function nextDayChips(count: number): DayChip[] {
  const out: DayChip[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + 1);
  while (out.length < count) {
    if (cursor.getDay() !== 0) {
      out.push({
        key: toDateKey(cursor),
        dow: DAY_NAMES[cursor.getDay()],
        label: `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getDate()}`,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function formatChipSummary(key: string): string {
  const d = parseDateKey(key);
  if (!d) return key;
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export function toScheduledAt(date: string, time: string): string | null {
  if (!date || !time) return null;
  const at = new Date(`${date}T${time}:00`);
  if (Number.isNaN(at.getTime())) return null;
  return `${date}T${time}:00`;
}
