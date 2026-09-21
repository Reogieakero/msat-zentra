"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  /** Save failure from the caller's API call (shown under validation errors). */
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

/**
 * Shared move-session modal — picks the new date and time. The caller
 * performs the save.
 */
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

  // Fresh form every time the modal opens — synced during render, never
  // in an effect.
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
        if (!next) {
          onClose();
          setError(null);
        }
      }}
    >
      <DialogContent className={styles.dialogScrollHidden}>
        <DialogHeader>
          <DialogTitle>Move session</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {keepLabel}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {busy ? "Moving…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
