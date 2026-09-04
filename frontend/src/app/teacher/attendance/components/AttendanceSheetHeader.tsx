"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import styles from "./AttendanceSheetHeader.module.css";

export type SheetSession = "AM" | "PM";

interface AttendanceSheetHeaderProps {
  date: string;
  onDateChange: (date: string) => void;
  session: SheetSession;
  onSessionChange: (session: SheetSession) => void;
  maxDate: string;
}

export function AttendanceSheetHeader({
  date,
  onDateChange,
  session,
  onSessionChange,
  maxDate,
}: AttendanceSheetHeaderProps) {
  const selected = React.useMemo(() => new Date(`${date}T00:00:00`), [date]);
  const maxDay = React.useMemo(() => new Date(`${maxDate}T00:00:00`), [maxDate]);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  return (
    <div className={styles.header}>
      <div className={styles.titleWrap}>
        <h1 className={styles.title}>Attendance</h1>
        <p className={styles.subtitle}>G7-A · mark each advisee present, absent, late, or excused.</p>
      </div>
      <div className={styles.controls}>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(styles.dateBtn, !date && "text-muted-foreground")}
            >
              <CalendarIcon aria-hidden />
              {format(selected, "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className={styles.datePanel}>
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected}
              disabled={{ after: maxDay }}
              onSelect={(day) => {
                if (day) {
                  onDateChange(format(day, "yyyy-MM-dd"));
                  setPickerOpen(false);
                }
              }}
            />
          </PopoverContent>
        </Popover>
        <div className={styles.tabs} role="group" aria-label="Session">
          {(["AM", "PM"] as SheetSession[]).map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={session === s ? "default" : "ghost"}
              onClick={() => onSessionChange(s)}
            >
              {s === "AM" ? "Morning" : "Afternoon"}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
