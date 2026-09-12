"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FormDropdown } from "./form-dropdown";
import { cn } from "@/lib/utils";
/* Half-hour slots across the school day, stored as "HH:MM". */
const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let hour = 7; hour <= 18; hour += 1) {
    for (const minute of [0, 30]) {
      slots.push(
        `${`${hour}`.padStart(2, "0")}:${`${minute}`.padStart(2, "0")}`
      );
    }
  }
  return slots;
})();

function formatSlot(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${`${m}`.padStart(2, "0")} ${suffix}`;
}

function parseDateInput(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

interface SessionDatePickerProps {
  id: string;
  label: string;
  /** "YYYY-MM-DD" ("" when unset). */
  value: string;
  onChange: (value: string) => void;
}

/** shadcn calendar-in-popover date picker speaking "YYYY-MM-DD". */
export function SessionDatePicker({
  id,
  label,
  value,
  onChange,
}: SessionDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseDateInput(value);

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "mt-1 w-full justify-start text-left font-normal",
              !selected && "text-muted-foreground"
            )}
          >
            <CalendarIcon aria-hidden />
            {selected ? format(selected, "MMM d, yyyy") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? new Date()}
            onSelect={(day) => {
              if (day) {
                onChange(format(day, "yyyy-MM-dd"));
                setOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface SessionTimePickerProps {
  id: string;
  label: string;
  /** "HH:MM" 24-hour ("" when unset). */
  value: string;
  onChange: (value: string) => void;
}

/** Readable time-slot dropdown ("2:30 PM") instead of a typed time input. */
export function SessionTimePicker({
  id,
  label,
  value,
  onChange,
}: SessionTimePickerProps) {
  const options = React.useMemo(
    () =>
      (value && !TIME_SLOTS.includes(value)
        ? [...TIME_SLOTS, value].sort()
        : TIME_SLOTS
      ).map((slot) => ({ value: slot, label: formatSlot(slot) })),
    [value]
  );

  return (
    <FormDropdown
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      placeholder="Pick a time"
      options={options}
      scrollable
    />
  );
}
