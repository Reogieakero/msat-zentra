"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { ClinicDatePicker, ClinicTimePicker } from "./ClinicDateTimePicker";
import {
  acceptNurseCase,
  apiErrorMessage,
  type NurseQueueRow,
} from "./nurse-overview-data";
import styles from "./nurse-overview.module.css";

/**
 * Clinic intake dialog: review first, record opening notes, book the first
 * clinic session, then accept — one atomic call so a case is never
 * half-accepted. Clinic matters only (ADM cases use the review dialog).
 */
export function NurseStartHandlingDialog({
  row,
  open,
  onClose,
  onChanged,
}: {
  row: NurseQueueRow;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [acting, setActing] = React.useState(false);
  const [startNote, setStartNote] = React.useState("");
  const [sessionDate, setSessionDate] = React.useState("");
  const [sessionTime, setSessionTime] = React.useState("");
  const [dialogError, setDialogError] = React.useState<string | null>(null);

  function todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async function handleStart() {
    // Real-world intake in one atomic call: review first, record opening
    // notes, book the first clinic session, then accept. Either everything
    // lands or the dialog stays open with the server's message.
    setDialogError(null);
    let scheduledAt: string | undefined;
    if (sessionDate || sessionTime) {
      if (!sessionDate || !sessionTime) {
        setDialogError("Pick both a date and a time for the clinic session — or leave both empty to accept without one.");
        return;
      }
      const at = new Date(`${sessionDate}T${sessionTime}:00`);
      if (Number.isNaN(at.getTime())) {
        setDialogError("Pick a valid date and time for the clinic session.");
        return;
      }
      if (at.getTime() <= Date.now()) {
        setDialogError("Clinic session must be set in the future.");
        return;
      }
      scheduledAt = `${sessionDate}T${sessionTime}:00`;
    }
    setActing(true);
    try {
      await acceptNurseCase(row.id, {
        intakeNotes: startNote.trim() ? startNote.trim() : undefined,
        scheduledAt,
      });
      toast.success({
        title: "Case accepted",
        description: scheduledAt
          ? `${row.student} is now in progress with a clinic session booked.`
          : `${row.student} is now in progress.`,
      });
      onClose();
      setStartNote("");
      setSessionDate("");
      setSessionTime("");
      onChanged();
    } catch (err) {
      setDialogError(apiErrorMessage(err, "Could not accept this case. Try again."));
    } finally {
      setActing(false);
    }
  }

  if (!open) return null;

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
          setDialogError(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start handling this case</DialogTitle>
          <DialogDescription>
            Review the referral, record your opening note, book the first clinic session, then accept it.
          </DialogDescription>
        </DialogHeader>
        <dl className={styles.intakeSummary}>
          <div className={styles.intakeRow}>
            <dt className={styles.intakeLabel}>Student</dt>
            <dd className={styles.intakeValue}>{row.student}</dd>
          </div>
          <div className={styles.intakeRow}>
            <dt className={styles.intakeLabel}>LRN</dt>
            <dd className={styles.intakeValue}>{row.lrn}</dd>
          </div>
          <div className={styles.intakeRow}>
            <dt className={styles.intakeLabel}>Section</dt>
            <dd className={styles.intakeValue}>{row.section}</dd>
          </div>
          <div className={styles.intakeRow}>
            <dt className={styles.intakeLabel}>Grade</dt>
            <dd className={styles.intakeValue}>{row.grade}</dd>
          </div>
          <div className={styles.intakeRow}>
            <dt className={styles.intakeLabel}>Case</dt>
            <dd className={styles.intakeValue}>
              {row.type === "ADM" ? "ADM case" : "Clinic matter"} · {row.category}
            </dd>
          </div>
          <div className={styles.intakeRow}>
            <dt className={styles.intakeLabel}>Reason</dt>
            <dd className={styles.intakeValue}>{row.reason}</dd>
          </div>
          <div className={styles.intakeRow}>
            <dt className={styles.intakeLabel}>Referred</dt>
            <dd className={styles.intakeValue}>{row.date}</dd>
          </div>
          <div className={styles.intakeRow}>
            <dt className={styles.intakeLabel}>Waiting</dt>
            <dd className={styles.intakeValue}>
              {row.waitingDays === null || row.waitingDays <= 0 ? "Referred today" : `${row.waitingDays}d`}
            </dd>
          </div>
        </dl>
        <div className={styles.dialogField}>
          <Label htmlFor={`start-${row.id}`}>Opening note (optional)</Label>
          <Textarea
            id={`start-${row.id}`}
            className={styles.dialogTextarea}
            placeholder="First impressions, initial findings, next steps…"
            value={startNote}
            onChange={(e) => setStartNote(e.target.value)}
          />
        </div>
        <div className={styles.dialogField}>
          <span className={styles.dialogLabel}>First clinic session (optional)</span>
          <div className={styles.sessionGrid}>
            <ClinicDatePicker
              id={`session-date-${row.id}`}
              label="Date"
              value={sessionDate}
              onChange={setSessionDate}
              min={todayKey()}
            />
            <ClinicTimePicker
              id={`session-time-${row.id}`}
              label="Time"
              value={sessionTime}
              onChange={setSessionTime}
            />
          </div>
          <p className={styles.dialogHint}>Held at the school clinic. Leave both empty to accept without booking.</p>
        </div>
        {dialogError ? <p className={styles.dialogError}>{dialogError}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void handleStart()} disabled={acting}>
            {acting ? "Accepting…" : "Accept & start handling"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
