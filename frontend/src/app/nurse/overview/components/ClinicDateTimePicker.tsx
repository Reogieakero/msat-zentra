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
import { ClockTimePicker } from "@/components/ui/clock-time-picker";
import { cn } from "@/lib/utils";

function parseDateInput(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

interface ClinicDatePickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  /** Extra classes for the field label (e.g. a denser size on boards). */
  labelClassName?: string;
}

export function ClinicDatePicker({
  id,
  label,
  value,
  onChange,
  min,
  labelClassName,
}: ClinicDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseDateInput(value);
  const minDate = parseDateInput(min ?? "");

  return (
    <div>
      <Label htmlFor={id} className={labelClassName}>{label}</Label>
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
            defaultMonth={selected ?? minDate ?? new Date()}
            disabled={minDate ? { before: minDate } : undefined}
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

interface ClinicTimePickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ClinicTimePicker({
  id,
  label,
  value,
  onChange,
}: ClinicTimePickerProps) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <ClockTimePicker
        id={id}
        value={value}
        onChange={onChange}
        placeholder="Pick a time"
        className="mt-1"
      />
    </div>
  );
}
