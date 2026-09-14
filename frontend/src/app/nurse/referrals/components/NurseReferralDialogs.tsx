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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { ClinicDatePicker, ClinicTimePicker } from "../../overview/components/ClinicDateTimePicker";
import {
  apiErrorMessage,
  cancelClinicSession,
  completeClinicSession,
  rescheduleClinicSession,
  scheduleClinicSession,
  updateNurseReferralStatus,
  type NurseQueueRow,
  type NurseSessionItem,
} from "../../overview/components/nurse-overview-data";
import styles from "@/app/guidance/referrals/components/guidance-referrals-table.module.css";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function toScheduledAt(date: string, time: string): string | null {
  if (!date || !time) return null;
  const at = new Date(`${date}T${time}:00`);
  if (Number.isNaN(at.getTime())) return null;
  return `${date}T${time}:00`;
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function ScheduleSessionDialog({
  referralId,
  student,
  open,
  onClose,
  onChanged,
}: DialogProps & { referralId: string; student: string }) {
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [venue, setVenue] = React.useState("");
  const [acting, setActing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!open) return null;

  async function save() {
    const scheduledAt = toScheduledAt(date, time);
    if (!scheduledAt) {
      setError("Pick both a date and a time for the clinic session.");
      return;
    }
    if (new Date(scheduledAt).getTime() <= Date.now()) {
      setError("Clinic session must be set in the future.");
      return;
    }
    setError(null);
    setActing(true);
    try {
      await scheduleClinicSession(referralId, {
        scheduledAt,
        ...(venue.trim() ? { venue: venue.trim() } : {}),
      });
      toast.success({ title: "Session scheduled", description: `Clinic session booked for ${student}.` });
      onClose();
      setDate("");
      setTime("");
      setVenue("");
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not schedule the session. Try again."));
    } finally {
      setActing(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) { onClose(); setError(null); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule a session</DialogTitle>
          <DialogDescription>
            Book a one-on-one clinic talk with {student}.
          </DialogDescription>
        </DialogHeader>
        <div className={styles.formGrid}>
          <ClinicDatePicker id="nurse-sess-date" label="Date" value={date} onChange={setDate} min={todayKey()} />
          <ClinicTimePicker id="nurse-sess-time" label="Time" value={time} onChange={setTime} />
          <div className={styles.formFull}>
            <Label htmlFor="nurse-sess-venue">Venue (optional)</Label>
            <Input
              id="nurse-sess-venue"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="School clinic"
              maxLength={200}
            />
          </div>
        </div>
        {error ? (<div className={styles.errorBlock} role="alert"><p className={styles.errorText}>{error}</p></div>) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={acting}>
            {acting ? "Booking…" : "Book session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FinishSessionDialog({
  referralId,
  session,
  open,
  onClose,
  onChanged,
}: DialogProps & { referralId: string; session: NurseSessionItem }) {
  const [notes, setNotes] = React.useState("");
  const [outcome, setOutcome] = React.useState("");
  const [followDate, setFollowDate] = React.useState("");
  const [followTime, setFollowTime] = React.useState("");
  const [acting, setActing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!open) return null;

  async function save() {
    if (!notes.trim()) {
      setError("Write what happened in the session first.");
      return;
    }
    let followUpAt: string | undefined;
    if (followDate || followTime) {
      const at = toScheduledAt(followDate, followTime);
      if (!at) {
        setError("Pick both a date and a time for the follow-up — or leave both empty.");
        return;
      }
      followUpAt = at;
    }
    setError(null);
    setActing(true);
    try {
      await completeClinicSession(referralId, session.id, {
        sessionNotes: notes.trim(),
        ...(outcome.trim() ? { outcome: outcome.trim() } : {}),
        ...(followUpAt ? { followUpAt } : {}),
      });
      toast.success({ title: "Session done", description: "The session was marked done." });
      onClose();
      setNotes("");
      setOutcome("");
      setFollowDate("");
      setFollowTime("");
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not finish the session. Try again."));
    } finally {
      setActing(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) { onClose(); setError(null); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark session done</DialogTitle>
          <DialogDescription>
            Record what happened. You can book the follow-up talk right away.
          </DialogDescription>
        </DialogHeader>
        <div className={styles.formGrid}>
          <div className={styles.formFull}>
            <Label htmlFor="nurse-done-notes">Session notes (required)</Label>
            <Textarea
              id="nurse-done-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What happened? What was discussed…"
              maxLength={5000}
            />
          </div>
          <div className={styles.formFull}>
            <Label htmlFor="nurse-done-outcome">Outcome (optional)</Label>
            <Textarea
              id="nurse-done-outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Result or next step…"
              maxLength={2000}
            />
          </div>
          <ClinicDatePicker id="nurse-follow-date" label="Follow-up date (optional)" value={followDate} onChange={setFollowDate} min={todayKey()} />
          <ClinicTimePicker id="nurse-follow-time" label="Follow-up time (optional)" value={followTime} onChange={setFollowTime} />
        </div>
        {error ? (<div className={styles.errorBlock} role="alert"><p className={styles.errorText}>{error}</p></div>) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={acting}>
            {acting ? "Saving…" : "Mark done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MoveSessionDialog({
  referralId,
  session,
  open,
  onClose,
  onChanged,
}: DialogProps & { referralId: string; session: NurseSessionItem }) {
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [acting, setActing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!open) return null;

  async function save() {
    const scheduledAt = toScheduledAt(date, time);
    if (!scheduledAt) {
      setError("Pick both a date and a time to move the session to.");
      return;
    }
    setError(null);
    setActing(true);
    try {
      await rescheduleClinicSession(referralId, session.id, scheduledAt);
      toast.success({ title: "Session moved", description: "The session was moved." });
      onClose();
      setDate("");
      setTime("");
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not move the session. Try again."));
    } finally {
      setActing(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) { onClose(); setError(null); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move session</DialogTitle>
          <DialogDescription>Pick the new date and time.</DialogDescription>
        </DialogHeader>
        <div className={styles.formGrid}>
          <ClinicDatePicker id="nurse-move-date" label="Date" value={date} onChange={setDate} min={todayKey()} />
          <ClinicTimePicker id="nurse-move-time" label="Time" value={time} onChange={setTime} />
        </div>
        {error ? (<div className={styles.errorBlock} role="alert"><p className={styles.errorText}>{error}</p></div>) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={acting}>
            {acting ? "Moving…" : "Move session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CancelSessionDialog({
  referralId,
  session,
  open,
  onClose,
  onChanged,
}: DialogProps & { referralId: string; session: NurseSessionItem }) {
  const [reason, setReason] = React.useState("");
  const [acting, setActing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!open) return null;

  async function save() {
    setError(null);
    setActing(true);
    try {
      await cancelClinicSession(referralId, session.id, reason.trim() || undefined);
      toast.success({ title: "Session cancelled", description: "The session was cancelled." });
      onClose();
      setReason("");
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not cancel the session. Try again."));
    } finally {
      setActing(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) { onClose(); setError(null); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel session</DialogTitle>
          <DialogDescription>This frees the slot. The case itself stays open.</DialogDescription>
        </DialogHeader>
        <div className={styles.formGrid}>
          <div className={styles.formFull}>
            <Label htmlFor="nurse-cancel-reason">Why is it cancelled? (optional)</Label>
            <Textarea
              id="nurse-cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for cancelling…"
              maxLength={500}
            />
          </div>
        </div>
        {error ? (<div className={styles.errorBlock} role="alert"><p className={styles.errorText}>{error}</p></div>) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={() => void save()} disabled={acting}>
            {acting ? "Cancelling…" : "Cancel session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ResolveCaseDialog({
  row,
  open,
  onClose,
  onChanged,
}: DialogProps & { row: NurseQueueRow }) {
  const [summary, setSummary] = React.useState("");
  const [acting, setActing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!open) return null;

  async function save() {
    setError(null);
    setActing(true);
    try {
      await updateNurseReferralStatus(
        row.id,
        "resolved",
        summary.trim() ? summary.trim() : undefined
      );
      toast.success({ title: "Case closed", description: `${row.student}'s case is resolved.` });
      onClose();
      setSummary("");
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not resolve this case. Try again."));
    } finally {
      setActing(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) { onClose(); setError(null); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finish &amp; close</DialogTitle>
          <DialogDescription>
            Close {row.student}&rsquo;s case. Add a closing summary so the next reader knows the outcome.
          </DialogDescription>
        </DialogHeader>
        <div className={styles.formGrid}>
          <div className={styles.formFull}>
            <Label htmlFor={`nurse-resolve-${row.id}`}>Closing summary (optional)</Label>
            <Textarea
              id={`nurse-resolve-${row.id}`}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What was done? What was the outcome…"
            />
          </div>
        </div>
        {error ? (<div className={styles.errorBlock} role="alert"><p className={styles.errorText}>{error}</p></div>) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={acting}>
            {acting ? "Closing…" : "Finish & close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

