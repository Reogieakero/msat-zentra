import { BellRing, CalendarDays, Check, Clock } from "lucide-react";
import { buildTimetable, formatClock, formatRange, type DayConfig } from "@/app/teacher/schedule/components/schedule-time";
export type TimetableReminderVariant = "amber" | "blue" | "green" | "gray";
export type TimetableReminder = {
  variant: TimetableReminderVariant;
  title: string;
  message: string;
};
export type ReminderSlot = {
  period: number;
  subject: { name: string };
  section: { name: string };
};
export function buildTimetableReminder(
  config: DayConfig | null,
  slots: ReminderSlot[],
  now: Date
): TimetableReminder | null {
  if (!config || slots.length === 0) return null;
  const dow = now.getDay();
  if (dow < 1 || dow > 5) {
    return {
      variant: "gray",
      title: "No classes today",
      message: "Enjoy the weekend — see you Monday.",
    };
  }
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const rows = buildTimetable(config);
  const timeOf = (period: number) => {
    const row = rows.find((r) => r.kind === "period" && r.periodIndex === period);
    return row && row.kind === "period" ? { start: row.startMin, end: row.endMin } : null;
  };
  const today = slots.flatMap((s) => {
    const t = timeOf(s.period);
    return t ? [{ slot: s, ...t }] : [];
  });
  const current = today.find((t) => nowMin >= t.start && nowMin < t.end);
  if (current) {
    return {
      variant: "amber",
      title: "Now",
      message: `${current.slot.subject.name} · ${current.slot.section.name} · ends ${formatClock(current.end)}.`,
    };
  }
  const upcoming = today
    .filter((t) => t.start > nowMin)
    .sort((a, b) => a.start - b.start)[0];
  if (upcoming) {
    return {
      variant: "blue",
      title: "Up next",
      message: `${upcoming.slot.subject.name} · ${upcoming.slot.section.name} · ${formatRange(upcoming.start, upcoming.end)}.`,
    };
  }
  return {
    variant: "green",
    title: "Done for today",
    message: "No more classes scheduled today.",
  };
}
export function getReminderMeta(reminder: TimetableReminder | null) {
  if (reminder === null) return null;
  return {
    amber: {
      from: "#f59e0b",
      to: "#d9770f",
      chip: "bg-amber-500/15",
      icon: "text-amber-500",
      Icon: BellRing,
    },
    blue: {
      from: "#3b82f6",
      to: "#2563d1",
      chip: "bg-blue-500/15",
      icon: "text-blue-500",
      Icon: Clock,
    },
    green: {
      from: "#22c55e",
      to: "#16a34a",
      chip: "bg-green-500/15",
      icon: "text-green-500",
      Icon: Check,
    },
    gray: {
      from: "#9ca3af",
      to: "#6b7280",
      chip: "bg-gray-500/15",
      icon: "text-gray-500",
      Icon: CalendarDays,
    },
  }[reminder.variant];
}
