"use client";

import * as React from "react";
import {
  CalendarClock,
  ClipboardCheck,
  ListChecks,
  Loader2,
  NotebookPen,
  Paperclip,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KanbanBoard } from "@/components/ui/kanban-board";
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
  followUpTitle?: string;
  followUpHint?: string;
  followUpDateLabel?: string;
  followUpTimeLabel?: string;
  venuePlaceholder?: string;
  showSessionType?: boolean;
  sessionTypeOptions?: { value: string; label: string }[];
  defaultSessionType?: string;
  showFollowUpVenue?: boolean;
  docsSection?: React.ReactNode;
  notStarted?: boolean;
  notStartedMessage?: string;
  busy?: boolean;
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

const BOARD_ICON = "text-primary";

/**
 * "Mark session done" — the same KanbanBoard overlay design as the other desk
 * confirmations (shared shell + one board per section, 24px footer buttons).
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

  // Escape closes the overlay — the same affordance as the other kanban
  // overlays (the backdrop button covers pointer users).
  React.useEffect(() => {
    if (!open || busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      onClose();
      setError(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

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

  function closeDialog() {
    onClose();
    setError(null);
  }

  return (
    <div
      className="whitespace-normal fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Mark session done"
      aria-busy={busy || undefined}
    >
      <button
        type="button"
        aria-label="Cancel"
        onClick={closeDialog}
        disabled={busy}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-2xl">
        <KanbanBoard
          className={`bg-card max-h-[90vh] overflow-y-auto shadow-2xl ${styles.dialogScrollHidden}`}
          title="Mark session done"
          icon={
            <span className={BOARD_ICON} aria-hidden>
              <ClipboardCheck size={14} />
            </span>
          }
          actions={
            /* 24px close X — same as the other overlay kanbans. */
            <button
              type="button"
              onClick={closeDialog}
              disabled={busy}
              autoFocus
              aria-label="Close dialog"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <X size={14} aria-hidden="true" />
            </button>
          }
          description={description}
          footer={
            /* 24px action buttons — same metric as the kanban boards. */
            <div className="flex flex-wrap items-center justify-end gap-1.5 px-1 pb-1">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className={`h-6 px-3 text-xs ${styles.btnRed}`}
                onClick={closeDialog}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-6 px-3 text-xs"
                onClick={save}
                disabled={!canSave}
                aria-busy={busy || undefined}
              >
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {busy ? "Marking done…" : submitLabel}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3 px-1 pb-1">
            {notStarted ? (
              <p className="px-1 text-xs italic text-red-600 dark:text-red-400" role="alert">
                {notStartedMessage}
              </p>
            ) : null}
            <KanbanBoard
              className="flex-1"
              title="Session notes (required)"
              icon={
                <span className={BOARD_ICON} aria-hidden>
                  <NotebookPen size={14} />
                </span>
              }
            >
              <div className="px-1">
                <Textarea
                  id={`${idPrefix}-notes`}
                  aria-label="Session notes (required)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What happened? What was discussed…"
                  maxLength={5000}
                />
              </div>
            </KanbanBoard>
            <KanbanBoard
              className="flex-1"
              title="Outcome (optional)"
              icon={
                <span className={BOARD_ICON} aria-hidden>
                  <ListChecks size={14} />
                </span>
              }
            >
              <div className="px-1">
                <Textarea
                  id={`${idPrefix}-outcome`}
                  aria-label="Outcome (optional)"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  placeholder="Result or next step…"
                  maxLength={2000}
                />
              </div>
            </KanbanBoard>
            {docsSection ? (
              <KanbanBoard
                className="flex-1"
                title="Documentation photos (optional)"
                icon={
                  <span className={BOARD_ICON} aria-hidden>
                    <Paperclip size={14} />
                  </span>
                }
              >
                {docsSection}
              </KanbanBoard>
            ) : null}
            <KanbanBoard
              className="flex-1"
              title={followUpTitle ?? "Follow-up session (optional)"}
              description={followUpHint}
              icon={
                <span className={BOARD_ICON} aria-hidden>
                  <CalendarClock size={14} />
                </span>
              }
            >
              <div className="grid gap-3 px-1 pb-1 sm:grid-cols-2">
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
                {showSessionType && sessionTypeOptions.length > 0 ? (
                  <FormDropdown
                    id={`${idPrefix}-follow-type`}
                    label="Follow-up kind"
                    value={followType}
                    onChange={setFollowType}
                    placeholder="Pick a kind"
                    options={sessionTypeOptions}
                  />
                ) : null}
                {showFollowUpVenue ? (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${idPrefix}-venue`}>Venue (optional)</Label>
                    <Input
                      id={`${idPrefix}-venue`}
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      placeholder={venuePlaceholder}
                      maxLength={200}
                    />
                  </div>
                ) : null}
              </div>
            </KanbanBoard>
            {error || serverError ? (
              <p className="px-1 text-xs italic text-red-600 dark:text-red-400" role="alert">
                {error ?? serverError}
              </p>
            ) : null}
          </div>
        </KanbanBoard>
      </div>
    </div>
  );
}
