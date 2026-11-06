"use client";

import { ClockTimePicker } from "@/components/ui/clock-time-picker";

interface TimePickersProps {
  value: string;
  onChange: (next: string) => void;
}

// Clock-face time overlay — shared with the nurse/ADM-review booking desks so
// every desk picks times the same way.
export function TimePickers({ value, onChange }: TimePickersProps) {
  return <ClockTimePicker value={value} onChange={onChange} />;
}
