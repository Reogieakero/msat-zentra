"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Meridiem = "AM" | "PM";

function to24(hour12: number, minute: number, ampm: Meridiem): string {
  const h24 = ampm === "AM" ? hour12 % 12 : (hour12 % 12) + 12;
  return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Parse a "HH:MM" 24-hour value into 12-hour clock parts. */
function parseTime(
  value: string
): { hour12: number; minute: number; ampm: Meridiem } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h24 = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(h24) || h24 > 23) return null;
  if (!Number.isFinite(minute) || minute > 59) return null;
  return { hour12: h24 % 12 || 12, minute, ampm: h24 < 12 ? "AM" : "PM" };
}

function facePoint(index: number): { left: string; top: string } {
  const angle = (index * 30 * Math.PI) / 180;
  return {
    left: `${50 + 38 * Math.sin(angle)}%`,
    top: `${50 - 38 * Math.cos(angle)}%`,
  };
}

/**
 * Clock-face time picker — pick the hour on the dial, then the minute, with
 * an AM/PM toggle. The trigger doubles as the field (label it with a <Label>).
 * All colors are theme tokens so it reads the same in light and dark mode.
 */
export function ClockTimePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a time",
  className,
}: {
  id?: string;
  /** "HH:MM" 24-hour value ("" when unset). */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Extra classes for the trigger button. */
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"hour" | "minute">("hour");
  const [hour, setHour] = React.useState(8);
  const [minute, setMinute] = React.useState(0);
  const [ampm, setAmpm] = React.useState<Meridiem>("AM");

  const parts = parseTime(value);
  const display = parts
    ? `${parts.hour12}:${String(parts.minute).padStart(2, "0")} ${parts.ampm}`
    : null;

  function syncFromValue() {
    const p = parseTime(value);
    setHour(p ? p.hour12 : 8);
    setMinute(p ? p.minute : 0);
    setAmpm(p ? p.ampm : "AM");
    setMode("hour");
  }

  function handleOpenChange(next: boolean) {
    if (next) syncFromValue();
    setOpen(next);
  }

  function pickHour(h: number) {
    setHour(h);
    onChange(to24(h, minute, ampm));
    setMode("minute");
  }

  function pickMinute(m: number) {
    setMinute(m);
    onChange(to24(hour, m, ampm));
  }

  function pickAmpm(next: Meridiem) {
    setAmpm(next);
    onChange(to24(hour, minute, next));
  }

  const hourAngle = (hour % 12) * 30 + minute * 0.5;
  const minuteAngle = minute * 6;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "w-full min-w-36 justify-start gap-2 font-normal tabular-nums",
            className
          )}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Clock size={14} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className={cn("truncate", !display && "text-muted-foreground")}>
            {display ?? placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <p className="m-0 text-center text-2xl font-bold tabular-nums">
          {String(hour).padStart(2, "0")}:{String(minute).padStart(2, "0")}
          <span className="ml-1.5 text-sm font-semibold text-muted-foreground">
            {ampm}
          </span>
        </p>

        <div
          className="flex rounded-md bg-muted p-0.5"
          role="tablist"
          aria-label="Clock mode"
        >
          {(["hour", "minute"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`h-6 flex-1 rounded-[4px] px-2 text-[11px] font-semibold capitalize transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                mode === m
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div
          className="relative mx-auto size-48 rounded-full border border-border bg-muted/40 dark:bg-muted/20"
          role="listbox"
          aria-label={mode === "hour" ? "Pick the hour" : "Pick the minute"}
        >
          {Array.from({ length: 12 }, (_, i) => {
            const isHour = mode === "hour";
            const faceValue = isHour ? (i === 0 ? 12 : i) : i * 5;
            const selected = isHour ? hour === faceValue : minute === faceValue;
            const pos = facePoint(i);
            return (
              <button
                key={i}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={isHour ? `${faceValue} o'clock` : `${faceValue} minutes`}
                onClick={() => (isHour ? pickHour(faceValue) : pickMinute(faceValue))}
                style={{ left: pos.left, top: pos.top }}
                className={`absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  selected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {isHour ? faceValue : String(faceValue).padStart(2, "0")}
              </button>
            );
          })}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ transform: `rotate(${hourAngle}deg)` }}
          >
            <div className="absolute bottom-1/2 left-1/2 h-[26%] w-1 -translate-x-1/2 rounded-full bg-primary/70" />
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ transform: `rotate(${minuteAngle}deg)` }}
          >
            <div className="absolute bottom-1/2 left-1/2 h-[36%] w-0.5 -translate-x-1/2 rounded-full bg-primary" />
          </div>
          <div
            aria-hidden
            className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
          />
        </div>

        <div className="flex rounded-md bg-muted p-0.5" aria-label="AM or PM">
          {(["AM", "PM"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={ampm === m}
              onClick={() => pickAmpm(m)}
              className={`h-6 flex-1 rounded-[4px] text-[11px] font-semibold transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                ampm === m
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <Button type="button" className="w-full" onClick={() => setOpen(false)}>
          Done
        </Button>
      </PopoverContent>
    </Popover>
  );
}
