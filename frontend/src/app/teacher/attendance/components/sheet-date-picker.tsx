"use client";

import * as React from "react";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { phTodayKey } from "@/services/teacher/attendance.service";

function parseDayKey(dayKey: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return undefined;
  const day = new Date(`${dayKey}T00:00:00`);
  return Number.isNaN(day.getTime()) ? undefined : day;
}

export function SheetDatePicker({
  date,
  onChange,
  meetupDates,
}: {

  date: string;
  onChange: (date: string) => void;

  meetupDates: string[] | null;
}) {
  const [open, setOpen] = React.useState(false);
  const todayKey = phTodayKey();
  const today = React.useMemo(
    () => parseDayKey(todayKey) ?? new Date(),
    [todayKey],
  );
  const meetupSet = React.useMemo(
    () => (meetupDates ? new Set(meetupDates) : null),
    [meetupDates],
  );
  const selected = parseDayKey(date);
  const isToday = date === todayKey;
  const isMarkable = (day: Date) => {
    if (day > today) return false;
    if (!meetupSet) return true;
    return meetupSet.has(format(day, "yyyy-MM-dd"));
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label="Attendance sheet date"
            className={cn(
              "justify-start text-left font-normal",
              !selected && "text-muted-foreground",
            )}
          >
            {selected ? format(selected, "MMM d, yyyy") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[280px] p-0">
          <div className="p-4">
          <Calendar
            mode="single"
            className="[--cell-size:--spacing(8)] w-full p-0"
            classNames={{ month: "flex w-full flex-col items-center gap-4" }}
            selected={selected}
            defaultMonth={selected ?? today}
            disabled={(day) => !isMarkable(day)}
            modifiers={{
              nonMeetup: (day) =>
                day <= today &&
                !!meetupSet &&
                !meetupSet.has(format(day, "yyyy-MM-dd")),
            }}
            modifiersClassNames={{
              nonMeetup: "bg-red-500/30",
            }}
            onSelect={(day) => {
              if (!day) return;
              const next = format(day, "yyyy-MM-dd");
              if (next > todayKey) return;
              if (meetupSet && !meetupSet.has(next)) return;
              onChange(next);
              setOpen(false);
            }}
          />
          </div>
        </PopoverContent>
      </Popover>
      {!isToday ? (
        <Badge variant="amber">Past sheet</Badge>
      ) : null}
      {!isToday ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(todayKey)}
        >
          Back to today
        </Button>
      ) : null}
    </div>
  );
}
