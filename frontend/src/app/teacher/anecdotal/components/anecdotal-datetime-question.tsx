"use client";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import styles from "./AnecdotalChat.module.css";
interface Props {
  locked: boolean;
  dateInput: string;
  setDateInput: (v: string) => void;
  timeInput: string;
  setTimeInput: (v: string) => void;
  popoverOpen: boolean;
  setPopoverOpen: (v: boolean) => void;
  onConfirm: () => void;
}
export function AnecdotalDatetimeQuestion({
  locked,
  dateInput,
  setDateInput,
  timeInput,
  setTimeInput,
  popoverOpen,
  setPopoverOpen,
  onConfirm,
}: Props) {
  return (
    <div className={styles.datetimePicker}>
      <div className={styles.datetimeRow}>
        <CalendarIcon className={styles.datetimeIcon} aria-hidden />
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={styles.datetimeDateBtn}
              disabled={locked}
              aria-haspopup="dialog"
              aria-expanded={popoverOpen}
            >
              <span className={styles.datetimeDateValue}>
                {dateInput || "Pick a date"}
              </span>
              <ChevronDown className={styles.datetimeChevron} aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent className={styles.datetimeCalendar} align="start">
            <Calendar
              mode="single"
              selected={
                dateInput ? new Date(`${dateInput}T00:00:00`) : undefined
              }
              defaultMonth={
                dateInput ? new Date(`${dateInput}T00:00:00`) : new Date()
              }
              disabled={locked ? true : { after: new Date() }}
              onSelect={(day) => {
                if (day && !locked) {
                  setDateInput(format(day, "yyyy-MM-dd"));
                }
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className={styles.datetimeRow}>
        <Clock className={styles.datetimeIcon} aria-hidden />
        <Input
          type="time"
          value={timeInput}
          onChange={(e) => setTimeInput(e.target.value)}
          disabled={locked}
          className={styles.datetimeTimeInput}
          aria-label="Observation time"
        />
      </div>
      {!locked && (
        <Button
          type="button"
          size="sm"
          variant="default"
          className={styles.datetimeConfirmBtn}
          disabled={!dateInput}
          onClick={onConfirm}
        >
          Confirm time
        </Button>
      )}
    </div>
  );
}
