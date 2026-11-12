"use client";

import { ClockTimePicker } from "@/components/ui/clock-time-picker";

interface TimePickersProps {
  value: string;
  onChange: (next: string) => void;
  /** Earliest pickable "HH:MM" (e.g. now for today). Earlier values are disabled. */
  minTime?: string;
}

// Clock-face time overlay — shared with the nurse/ADM-review booking desks so
// every desk picks times the same way.
export function TimePickers({ value, onChange, minTime }: TimePickersProps) {
  return <ClockTimePicker value={value} onChange={onChange} minTime={minTime} />;
}
