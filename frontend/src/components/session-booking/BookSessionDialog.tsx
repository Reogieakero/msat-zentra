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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDropdown } from "@/app/guidance/referrals/components/form-dropdown";
import {
  ClinicDatePicker,
  ClinicTimePicker,
} from "@/app/nurse/overview/components/ClinicDateTimePicker";
import styles from "./BookSessionDialog.module.css";

export interface BookSessionFields {
  scheduledAt: string;
  sessionType: string;
  venue: string;
}

interface BookSessionDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: BookSessionFields) => void;
  /** "Book a clinic session for Maria." */
  description: string;
  /** Shown under the venue field, e.g. where the session is held. */
  venueHint?: string;
  /** Label for the free-text venue box — defaults to "Venue (optional)".
      The ADM coordinator reuses it as the logbook-ref field. */
  venueLabel?: string;
  venuePlaceholder?: string;
  /** Counseling desks pick a kind; the clinic desk books one-on-one only. */
  showSessionType?: boolean;
  /** Label for the kind dropdown — defaults to "Session kind". The ADM
      coordinator reuses it as the venue picker ("Venue"). */
  sessionTypeLabel?: string;
  sessionTypeOptions?: { value: string; label: string }[];
  defaultSessionType?: string;
  /** One-active-session rule: set when a session is already booked. */
  hasActiveSession?: boolean;
  activeSessionMessage?: string;
  busy?: boolean;
  /** Save failure from the caller's API call (shown under validation errors). */
  serverError?: string | null;
  submitLabel?: string;
  busyLabel?: string;
  title?: string;
  initialDate?: string;
  initialTime?: string;
  initialVenue?: string;
  initialSessionType?: string;
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
 * Shared book-session modal — the same dialog on the nurse clinic desk, the
 * guidance desks, and the ADM coordinator referrals desk. Date + time
 * pickers, optional venue, and an optional session-kind dropdown, with the
 * future-date and one-active-session guards built in. The caller performs
 * the save.
 */
export function BookSessionDialog({
  open,
  onClose,
  onSubmit,
  description,
  venueHint,
  venueLabel = "Venue (optional)",
  venuePlaceholder = "e.g. School clinic",
  showSessionType = false,
  sessionTypeLabel = "Session kind",
  sessionTypeOptions = [],
  defaultSessionType = "individual",
  hasActiveSession = false,
  activeSessionMessage = "This case already has a session that is not done yet — finish or cancel it before booking another one.",
  busy = false,
  serverError = null,
  submitLabel = "Book session",
  busyLabel,
  title = "Book session",
  initialDate = "",
  initialTime = "",
  initialVenue = "",
  initialSessionType,
  idPrefix = "book-session",
}: BookSessionDialogProps) {
  const [date, setDate] = React.useState(initialDate);
  const [time, setTime] = React.useState(initialTime);
  const [venue, setVenue] = React.useState(initialVenue);
  const [sessionType, setSessionType] = React.useState(
    initialSessionType ?? defaultSessionType,
  );
  const [error, setError] = React.useState<string | null>(null);

  // Fresh form every time the modal opens — synced during render, never
  // in an effect. Reschedule opens prefill from the booked meeting.
  const openKey = open
    ? `${defaultSessionType}|${initialDate}|${initialTime}|${initialVenue}|${initialSessionType ?? ""}`
    : null;
  const [prevOpenKey, setPrevOpenKey] = React.useState<string | null>(null);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    setDate(initialDate);
    setTime(initialTime);
    setVenue(initialVenue);
    setSessionType(initialSessionType ?? defaultSessionType);
    setError(null);
  }

  if (!open) return null;

  function save() {
    const scheduledAt = toScheduledAt(date, time);
    if (!scheduledAt) {
      setError("Pick both a date and a time for the session.");
      return;
    }
    if (new Date(scheduledAt).getTime() <= Date.now()) {
      setError("Session must be set in the future.");
      return;
    }
    if (hasActiveSession) {
      setError(activeSessionMessage);
      return;
    }
    setError(null);
    onSubmit({ scheduledAt, sessionType, venue: venue.trim() });
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
          <DialogTitle>{title}</DialogTitle>
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
          {showSessionType && sessionTypeOptions.length > 0 && (
            <FormDropdown
              id={`${idPrefix}-type`}
              label={sessionTypeLabel}
              value={sessionType}
              onChange={setSessionType}
              placeholder="Pick a kind"
              options={sessionTypeOptions}
            />
          )}
          <div className={styles.formFull}>
            <Label htmlFor={`${idPrefix}-venue`}>{venueLabel}</Label>
            <Input
              id={`${idPrefix}-venue`}
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder={venuePlaceholder}
              maxLength={200}
            />
            {venueHint ? <p className={styles.hint}>{venueHint}</p> : null}
          </div>
        </div>
        {error || serverError ? (
          <div className={styles.errorBlock} role="alert">
            <p className={styles.errorText}>{error ?? serverError}</p>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="destructive" className={styles.btnRed} onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {busy ? (busyLabel ?? "Booking…") : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
