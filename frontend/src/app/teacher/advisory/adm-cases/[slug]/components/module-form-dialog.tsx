"use client";

import * as React from "react";
import { format } from "date-fns";
import { BookOpen, CalendarIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type {
  AdmModulePayload,
  AdmMonitoredModule,
} from "@/services/teacher/admMonitoring.service";

/** Local-midnight ISO for a picked day, matching what the API stores. */
const toIso = (value: Date | undefined) =>
  value ? new Date(`${format(value, "yyyy-MM-dd")}T00:00:00`).toISOString() : null;

const fromIso = (iso: string | null) => {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export function ModuleFormDialog({
  module,
  pending,
  onClose,
  onSubmit,
}: {
  /** The case module being edited. New modules are released from the advisory Modules desk. */
  module: AdmMonitoredModule;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: AdmModulePayload) => void;
}) {
  const [moduleName, setModuleName] = React.useState(module?.moduleName ?? "");
  const [dueDate, setDueDate] = React.useState<Date | undefined>(
    fromIso(module?.dueDate ?? null)
  );
  const [dueOpen, setDueOpen] = React.useState(false);
  const [submissionUrl, setSubmissionUrl] = React.useState(module?.submissionUrl ?? "");
  const [submitted, setSubmitted] = React.useState(module?.submitted ?? false);
  const releasedOn = fromIso(module?.releaseDate ?? null);

  const canSubmit = moduleName.trim().length > 0 && !pending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      moduleName: moduleName.trim(),
      dueDate: toIso(dueDate),
      // Where the adviser uploaded the module for the learner.
      submissionUrl: submissionUrl.trim() ? submissionUrl.trim() : null,
      // The student hands in the answered module; the adviser records it.
      submitted,
    });
  };

  return (
    <KanbanOverlay
      open
      onClose={() => {
        if (!pending) onClose();
      }}
      dismissable={!pending}
      title="Edit module"
      ariaLabel="Edit module"
      icon={<BookOpen size={16} aria-hidden />}
      description="Update the module details, its link, and the student's submission."
      width="lg"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2 px-1 pb-1">
          <Button
            type="button"
            className="h-6 px-2.5 text-xs"
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-busy={pending || undefined}
          >
            {pending ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
            Save changes
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="module-name">Module name</Label>
          <Input
            id="module-name"
            value={moduleName}
            onChange={(e) => setModuleName(e.target.value)}
            placeholder="e.g. Module 1 · Reading Comprehension"
            maxLength={120}
            autoFocus
          />
          <p className="m-0 text-[11px] text-muted-foreground">
            {releasedOn
              ? `Released ${format(releasedOn, "MMM d, yyyy")} — set automatically on upload.`
              : "Release date is set automatically once the module is uploaded."}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="module-due">Due date (optional)</Label>
          <Popover open={dueOpen} onOpenChange={setDueOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                id="module-due"
                variant="outline"
                aria-label="Module due date"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dueDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon size={14} aria-hidden />
                {dueDate ? format(dueDate, "MMM d, yyyy") : "No due date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dueDate}
                defaultMonth={dueDate}
                onSelect={(day) => {
                  setDueDate(day);
                  setDueOpen(false);
                }}
              />
              {dueDate ? (
                <div className="border-t p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center text-xs"
                    onClick={() => {
                      setDueDate(undefined);
                      setDueOpen(false);
                    }}
                  >
                    Clear due date
                  </Button>
                </div>
              ) : null}
            </PopoverContent>
          </Popover>
          <p className="m-0 text-[11px] text-muted-foreground">
            Optional — leave empty when the module has no deadline.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="module-url">Module link (Google Drive)</Label>
          <Input
            id="module-url"
            type="url"
            inputMode="url"
            value={submissionUrl}
            onChange={(e) => setSubmissionUrl(e.target.value)}
            placeholder="https://drive.google.com/…"
          />
          <p className="m-0 text-[11px] text-muted-foreground">
            Where the module is posted for the learner. Saving a link releases the module today.
          </p>
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
          <Checkbox
            checked={submitted}
            disabled={pending}
            onCheckedChange={(value) => setSubmitted(value === true)}
          />
          Student submitted the answered module
        </label>
      </div>
    </KanbanOverlay>
  );
}
