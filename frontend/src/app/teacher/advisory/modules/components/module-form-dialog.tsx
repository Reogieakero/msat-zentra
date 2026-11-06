"use client";

import * as React from "react";
import { format } from "date-fns";
import { BookOpen, CalendarIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type {
  AdvisoryModuleKind,
  AdvisoryModulePayload,
  AdvisoryModuleRow,
} from "@/services/teacher/advisoryModules.service";

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
  /** null = release a new module; otherwise edit this one. */
  module: AdvisoryModuleRow | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: AdvisoryModulePayload) => void;
}) {
  const [moduleName, setModuleName] = React.useState(module?.moduleName ?? "");
  const [kind, setKind] = React.useState<AdvisoryModuleKind>(module?.kind ?? "general");
  const [dueDate, setDueDate] = React.useState<Date | undefined>(fromIso(module?.dueDate ?? null));
  const [dueOpen, setDueOpen] = React.useState(false);
  const [moduleUrl, setModuleUrl] = React.useState(module?.moduleUrl ?? "");
  const [description, setDescription] = React.useState(module?.description ?? "");
  const releasedOn = fromIso(module?.releaseDate ?? null);

  const editing = module !== null;
  const canSubmit = moduleName.trim().length > 0 && !pending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      moduleName: moduleName.trim(),
      ...(editing ? {} : { kind }),
      dueDate: toIso(dueDate),
      moduleUrl: moduleUrl.trim() ? moduleUrl.trim() : null,
      description: description.trim() ? description.trim() : null,
    });
  };

  return (
    <KanbanOverlay
      open
      onClose={() => {
        if (!pending) onClose();
      }}
      dismissable={!pending}
      title={editing ? "Edit module" : "Release a module"}
      ariaLabel={editing ? "Edit module" : "Release a module"}
      icon={<BookOpen size={16} aria-hidden />}
      description={
        editing
          ? "Update the module details and the link your advisees use."
          : "Post the module your advisees must answer — the whole section sees it."
      }
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
            {editing ? "Save changes" : "Add module"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label>Module type</Label>
          <div role="radiogroup" aria-label="Module type" className="grid gap-2 sm:grid-cols-2">
            {(
              [
                {
                  value: "general" as const,
                  label: "General post",
                  hint: "Post only — no submissions tracked. Use for references and announcements.",
                },
                {
                  value: "adm" as const,
                  label: "ADM module",
                  hint: "Released to every ADM learner in your section; submissions are tracked.",
                },
              ]
            ).map((option) => {
              const active = kind === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={pending || editing}
                  onClick={() => setKind(option.value)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-md border px-2.5 py-2 text-left transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    editing && !active ? "opacity-60" : "",
                  )}
                >
                  <span className="text-xs font-semibold">{option.label}</span>
                  <span className="text-[11px] leading-tight">{option.hint}</span>
                </button>
              );
            })}
          </div>
          {editing ? (
            <p className="m-0 text-[11px] text-muted-foreground">
              Type is fixed after release.
            </p>
          ) : null}
        </div>

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
              : "Release date is set automatically once the module link is saved."}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="module-url">Module link (Google Drive)</Label>
          <Input
            id="module-url"
            type="url"
            inputMode="url"
            value={moduleUrl}
            onChange={(e) => setModuleUrl(e.target.value)}
            placeholder="https://drive.google.com/…"
          />
          <p className="m-0 text-[11px] text-muted-foreground">
            Where the module is posted for the section. Saving a link releases the module today.
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
                  !dueDate && "text-muted-foreground",
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
          <Label htmlFor="module-description">Instructions (optional)</Label>
          <Input
            id="module-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What the learner must do"
            maxLength={1000}
          />
        </div>
      </div>
    </KanbanOverlay>
  );
}
