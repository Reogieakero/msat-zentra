"use client";

import * as React from "react";
import { CalendarClock, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  ClinicDatePicker,
  ClinicTimePicker,
} from "@/app/nurse/overview/components/ClinicDateTimePicker";
import styles from "./BookSessionDialog.module.css";

interface RescheduleSessionDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (scheduledAt: string) => void;
  description?: string;
  busy?: boolean;
  serverError?: string | null;
  submitLabel?: string;
  keepLabel?: string;
  idPrefix?: string;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function toScheduledAt(date: string, time: string): string | null {
  if (!date || !time) return null;
  const at = new Date(`${date}T${time}:00`);
  if (Number.isNaN(at.getTime())) return null;
  return `${date}T${time}:00`;
}

export function RescheduleSessionDialog({
  open,
  onClose,
  onSubmit,
  description = "Pick the new date and time.",
  busy = false,
  serverError = null,
  submitLabel = "Move session",
  keepLabel = "Keep as is",
  idPrefix = "move-session",
}: RescheduleSessionDialogProps) {
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const openKey = open ? idPrefix : null;
  const [prevOpenKey, setPrevOpenKey] = React.useState<string | null>(null);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    setDate("");
    setTime("");
    setError(null);
  }

  if (!open) return null;

  function save() {
    const scheduledAt = toScheduledAt(date, time);
    if (!scheduledAt) {
      setError("Pick both a date and a time to move the session to.");
      return;
    }
    setError(null);
    onSubmit(scheduledAt);
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !busy) {
          onClose();
          setError(null);
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={`${styles.dialogScrollHidden} sm:max-w-md`}
        aria-busy={busy || undefined}
      >
        {/* Title/description live on the kanban board below (the sr-only pair
            keeps the dialog labelled for screen readers). */}
        <DialogTitle className="sr-only">Move session</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <KanbanBoard
          className="bg-card"
          title="Move session"
          icon={<CalendarClock className="size-3.5" aria-hidden="true" />}
          description={description}
          actions={
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-6"
                aria-label="Close"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </DialogClose>
          }
          footer={
            <div className="-mx-2.5 -mb-2.5 flex flex-col-reverse gap-2 border-t border-border px-3.5 py-2.5 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="h-6 px-2.5 text-xs"
                onClick={onClose}
                disabled={busy}
              >
                {keepLabel}
              </Button>
              <Button
                className="h-6 px-2.5 text-xs"
                onClick={save}
                disabled={busy}
                aria-busy={busy || undefined}
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : null}
                {busy ? "Moving…" : submitLabel}
              </Button>
            </div>
          }
        >
          <div className={styles.formGrid}>
            <ClinicDatePicker
              id={`${idPrefix}-date`}
              label="Date"
              value={date}
              onChange={setDate}
              min={todayKey()}
            />
            <ClinicTimePicker
              id={`${idPrefix}-time`}
              label="Time"
              value={time}
              onChange={setTime}
            />
          </div>
          {error || serverError ? (
            <div className={styles.errorBlock} role="alert">
              <p className={styles.errorText}>{error ?? serverError}</p>
            </div>
          ) : null}
        </KanbanBoard>
      </DialogContent>
    </Dialog>
  );
}
