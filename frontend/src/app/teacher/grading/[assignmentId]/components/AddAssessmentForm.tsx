"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { COMPONENT_LABELS } from "@/services/teacher/grading.compute";
import type { ComponentType } from "@/services/teacher/grading.types";
import { cn } from "@/lib/utils";
import { CategoryTabs } from "./CategoryTabs";
import { useAddAssessmentSave } from "./add-assessment-save-context";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDayKey(dayKey: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return undefined;
  const day = new Date(`${dayKey}T00:00:00`);
  return Number.isNaN(day.getTime()) ? undefined : day;
}

type Props = {
  assignmentId: string;
  defaultType?: ComponentType;
  onSaved: () => void;
};

/**
 * Compact add-assessment form designed to live inside the gutter
 * dropdown panel (not a modal overlay). The save itself runs in the
 * root-level provider, so the dock keeps working across navigation.
 */
export function AddAssessmentForm({
  assignmentId,
  defaultType = "WRITTEN_WORK",
  onSaved,
}: Props) {
  const { saveAssessment } = useAddAssessmentSave();
  const [componentType, setComponentType] =
    React.useState<ComponentType>(defaultType);
  const [title, setTitle] = React.useState("");
  const [max, setMax] = React.useState("100");
  const [date, setDate] = React.useState(todayKey());
  const [dateOpen, setDateOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedDate = parseDayKey(date);

  const handleSave = async () => {
    if (saving) return;
    const maxScore = Number(max);
    if (!title.trim()) {
      setError("Assessment title is required.");
      return;
    }
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      setError("Max score must be greater than 0.");
      return;
    }
    setError(null);
    setSaving(true);
    const trimmedTitle = title.trim();
    const pills = [
      COMPONENT_LABELS[componentType],
      `${maxScore} max`,
      selectedDate ? format(selectedDate, "MM/dd/yyyy") : "No date",
    ];
    // The dock opens this tick inside the provider and keeps running even
    // if the user navigates away mid-flight.
    const result = await saveAssessment(assignmentId, {
      componentType,
      title: trimmedTitle,
      maxScore,
      dateGiven: date
        ? new Date(`${date}T00:00:00Z`).toISOString()
        : undefined,
      pills,
    });
    setSaving(false);
    if (result.ok) {
      setTitle("");
      onSaved();
    } else {
      setError(result.message);
    }
  };

  return (
    <form
      className="flex flex-col gap-3 px-1"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Category
        </span>
        <CategoryTabs value={componentType} onChange={setComponentType} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label
          className="text-xs text-muted-foreground"
          htmlFor="gutter-add-assessment-title"
        >
          Title
        </Label>
        <Input
          id="gutter-add-assessment-title"
          value={title}
          placeholder="e.g. Quiz 1"
          onChange={(e) => setTitle(e.target.value)}
          disabled={saving}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label
            className="text-xs text-muted-foreground"
            htmlFor="gutter-add-assessment-max"
          >
            Max score
          </Label>
          <Input
            id="gutter-add-assessment-max"
            inputMode="decimal"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label
            className="text-xs text-muted-foreground"
            htmlFor="gutter-add-assessment-date"
          >
            Date given
          </Label>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                id="gutter-add-assessment-date"
                type="button"
                variant="outline"
                disabled={saving}
                className={cn(
                  "min-w-0 justify-start px-2 text-left font-normal",
                  !selectedDate && "text-muted-foreground",
                )}
              >
                <CalendarIcon
                  size={14}
                  className="shrink-0"
                  aria-hidden="true"
                />
                <span className="truncate">
                  {selectedDate
                    ? format(selectedDate, "MM/dd/yyyy")
                    : "Pick a date"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                defaultMonth={selectedDate ?? new Date()}
                onSelect={(day) => {
                  if (!day) return;
                  setDate(format(day, "yyyy-MM-dd"));
                  setDateOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end pb-1">
        <Button
          type="submit"
          size="sm"
          className="h-6 rounded-lg bg-black px-3 text-xs text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          disabled={saving}
          aria-busy={saving || undefined}
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin" aria-hidden size={14} />
              Adding…
            </>
          ) : (
            "Add assessment"
          )}
        </Button>
      </div>
    </form>
  );
}
