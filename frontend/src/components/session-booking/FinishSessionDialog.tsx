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
import { Textarea } from "@/components/ui/textarea";
import { FormDropdown } from "@/app/guidance/referrals/components/form-dropdown";
import {
  ClinicDatePicker,
  ClinicTimePicker,
} from "@/app/nurse/overview/components/ClinicDateTimePicker";
import styles from "./BookSessionDialog.module.css";

export interface FinishSessionFields {
  sessionNotes: string;
  outcome?: string;
  followUpSession?: {
    scheduledAt: string;
    sessionType: string;
    venue?: string;
  };
}

interface FinishSessionDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: FinishSessionFields) => void;
  description: string;
  /** Optional section header above the follow-up booking (guidance desks). */
  followUpTitle?: string;
  followUpHint?: string;
  followUpDateLabel?: string;
  followUpTimeLabel?: string;
  venuePlaceholder?: string;
  /** Counseling desks pick a follow-up kind; the clinic desk does not. */
  showSessionType?: boolean;
  sessionTypeOptions?: { value: string; label: string }[];
  defaultSessionType?: string;
  /** The clinic follow-up carries no venue — guidance desks do. */
  showFollowUpVenue?: boolean;
  /** Extra section between outcome and follow-up booking (clinic photo docs). */
  docsSection?: React.ReactNode;
  /** Guard for stale views: a session that hasn't started can't be finished. */
  notStarted?: boolean;
  notStartedMessage?: string;
  busy?: boolean;
  /** Save failure from the caller's API call (shown under validation errors). */
  serverError?: string | null;
  submitLabel?: string;
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
 * Shared mark-done modal — notes (required), outcome (optional), and an
 * optional follow-up booking, with the future-date guard built in. The
 * caller performs the save (and any documentation uploads).
 */
export function FinishSessionDialog({
  open,
  onClose,
  onSubmit,
  description,
  followUpTitle,
  followUpHint,
  followUpDateLabel = "Follow-up date (optional)",
  followUpTimeLabel = "Follow-up time (optional)",
  venuePlaceholder = "e.g. School clinic",
  showSessionType = false,
  sessionTypeOptions = [],
  defaultSessionType = "individual",
  showFollowUpVenue = true,
  docsSection,
  notStarted = false,
  notStartedMessage = "This session hasn't started yet — you can mark it done once the scheduled time arrives.",
  busy = false,
  serverError = null,
  submitLabel = "Mark done",
  idPrefix = "finish-session",
}: FinishSessionDialogProps) {
  const [notes, setNotes] = React.useState("");
  const [outcome, setOutcome] = React.useState("");
  const [followDate, setFollowDate] = React.useState("");
  const [followTime, setFollowTime] = React.useState("");
  const [followType, setFollowType] = React.useState(defaultSessionType);
  const [venue, setVenue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Fresh form every time the modal opens — synced during render, never
  // in an effect.
  const openKey = open ? defaultSessionType : null;
  const [prevOpenKey, setPrevOpenKey] = React.useState<string | null>(null);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    setNotes("");
    setOutcome("");
    setFollowDate("");
    setFollowTime("");
    setFollowType(defaultSessionType);
    setVenue("");
    setError(null);
  }

  if (!open) return null;

  const canSave = !busy && !notStarted && notes.trim() !== "";

  function save() {
    if (notStarted) {
      setError(notStartedMessage);
      return;
    }
    if (!notes.trim()) {
      setError("Write what happened in the session first.");
      return;
    }
    let followUpSession: FinishSessionFields["followUpSession"];
    if (followDate || followTime) {
      const scheduledAt = toScheduledAt(followDate, followTime);
      if (!scheduledAt) {
        setError("Pick both a date and a time for the follow-up — or leave both empty.");
        return;
      }
      followUpSession = {
        scheduledAt,
        sessionType: followType,
        ...(venue.trim() ? { venue: venue.trim() } : {}),
      };
    }
    setError(null);
    onSubmit({
      sessionNotes: notes.trim(),
      ...(outcome.trim() ? { outcome: outcome.trim() } : {}),
      ...(followUpSession ? { followUpSession } : {}),
    });
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
          <DialogTitle>Mark session done</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {notStarted ? (
          <div className={styles.errorBlock} role="alert">
            <p className={styles.errorText}>{notStartedMessage}</p>
          </div>
        ) : null}
        <div className={styles.formGrid}>
          <div className={styles.formFull}>
            <Label htmlFor={`${idPrefix}-notes`}>Session notes (required)</Label>
            <Textarea
              id={`${idPrefix}-notes`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What happened? What was discussed…"
              maxLength={5000}
            />
          </div>
          <div className={styles.formFull}>
            <Label htmlFor={`${idPrefix}-outcome`}>Outcome (optional)</Label>
            <Textarea
              id={`${idPrefix}-outcome`}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Result or next step…"
              maxLength={2000}
            />
          </div>
          {docsSection}
          {(followUpTitle || followUpHint) && (
            <div className={styles.formFull}>
              {followUpTitle ? (
                <p className={styles.hint} style={{ fontWeight: 600, color: "var(--foreground)" }}>
                  {followUpTitle}
                </p>
              ) : null}
              {followUpHint ? <p className={styles.hint}>{followUpHint}</p> : null}
            </div>
          )}
          <ClinicDatePicker
            id={`${idPrefix}-follow-date`}
            label={followUpDateLabel}
            value={followDate}
            onChange={setFollowDate}
            min={todayKey()}
          />
          <ClinicTimePicker
            id={`${idPrefix}-follow-time`}
            label={followUpTimeLabel}
            value={followTime}
            onChange={setFollowTime}
          />
          {showSessionType && sessionTypeOptions.length > 0 && (
            <FormDropdown
              id={`${idPrefix}-follow-type`}
              label="Follow-up kind"
              value={followType}
              onChange={setFollowType}
              placeholder="Pick a kind"
              options={sessionTypeOptions}
            />
          )}
          {showFollowUpVenue && (
            <div className={styles.formFull}>
              <Label htmlFor={`${idPrefix}-venue`}>Venue (optional)</Label>
              <Input
                id={`${idPrefix}-venue`}
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder={venuePlaceholder}
                maxLength={200}
              />
            </div>
          )}
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
          <Button onClick={save} disabled={!canSave}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {busy ? "Marking done…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
