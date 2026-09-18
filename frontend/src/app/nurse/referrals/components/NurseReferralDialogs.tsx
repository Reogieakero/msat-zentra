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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { Download, Loader2, Printer } from "lucide-react";
import { fetchOcForm01Detail } from "@/components/ocform01/ocform01";
import { CONCERN_OPTIONS, buildGcForm03Data, type GcForm03Data } from "@/app/guidance/adm/components/gcform03-data";
import type { GuidanceAdmCase } from "@/app/guidance/adm/components/guidance-adm-data";
import sheetStyles from "@/app/guidance/adm/components/GcForm03PreviewDialog.module.css";
import { ClinicDatePicker, ClinicTimePicker } from "../../overview/components/ClinicDateTimePicker";
import {
  apiErrorMessage,
  cancelClinicSession,
  clinicAttachmentError,
  completeClinicSession,
  confirmNurseReferralAndEndorse,
  deleteClinicAttachment,
  deleteClinicSession,
  forwardNurseAdmCase,
  parseSavedNurseAdmForm,
  rescheduleClinicSession,
  scheduleClinicSession,
  updateNurseReferralStatus,
  uploadClinicAttachments,
  type ClinicAttachment,
  type NurseAdmReferralForm,
  type NurseQueueRow,
  type NurseSessionItem,
} from "../../overview/components/nurse-overview-data";
import styles from "./NurseReferralDialogs.module.css";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function toScheduledAt(date: string, time: string): string | null {
  if (!date || !time) return null;
  const at = new Date(`${date}T${time}:00`);
  if (Number.isNaN(at.getTime())) return null;
  return `${date}T${time}:00`;
}

/* Live clock for session-gate checks below — ticks each second while the
   dialog is open so "starts at" guards stay exact without calling Date
   during render. */
function useNowTick(active: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function ScheduleSessionDialog({
  referralId,
  student,
  sessions = [],
  open,
  onClose,
  onChanged,
}: DialogProps & { referralId: string; student: string; sessions?: NurseSessionItem[] }) {
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [venue, setVenue] = React.useState("");
  const [acting, setActing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!open) return null;

  // One active session per referral — booking waits until the existing
  // scheduled session is done or cancelled.
  const blocked = sessions.some((s) => s.status === "scheduled");

  async function save() {
    if (blocked) {
      setError("This referral already has a session that is not done yet — finish or cancel it before booking another one.");
      return;
    }
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
        {blocked ? (
          <div className={styles.errorBlock} role="alert">
            <p className={styles.errorText}>
              This referral already has a session that is not done yet — finish or cancel it before booking another one.
            </p>
          </div>
        ) : null}
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
          <Button onClick={() => void save()} disabled={acting || blocked}>
            {acting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Book session
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
  const [files, setFiles] = React.useState<File[]>([]);
  const [acting, setActing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const now = useNowTick(open);

  if (!open) return null;

  // A still-upcoming session cannot be marked done — it unlocks once the
  // scheduled time arrives. The card disables the button too; this is the
  // in-dialog guard for stale views and direct calls.
  const notStarted = new Date(session.scheduledAt).getTime() > now;

  function onPickFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list).slice(0, 5);
    const problem = clinicAttachmentError(picked);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setFiles(picked);
  }

  async function save() {
    if (notStarted) {
      setError("This session hasn't started yet — you can mark it done once the scheduled time arrives.");
      return;
    }
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
    if (files.length > 0) {
      const problem = clinicAttachmentError(files);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setError(null);
    setActing(true);
    try {
      // Step 1 — mark the session done (required). Step 2 — file the
      // optional photos (docs never block Done; a failed upload keeps the
      // dialog open so the nurse can retry or close anyway).
      await completeClinicSession(referralId, session.id, {
        sessionNotes: notes.trim(),
        ...(outcome.trim() ? { outcome: outcome.trim() } : {}),
        ...(followUpAt ? { followUpAt } : {}),
      });
      if (files.length > 0) {
        try {
          await uploadClinicAttachments(referralId, session.id, files);
        } catch (uploadErr) {
          onChanged();
          setError(apiErrorMessage(uploadErr, "Session is done, but the photos did not upload. Try attaching them again from the session list."));
          return;
        }
      }
      toast.success({
        title: "Session done",
        description: files.length > 0
          ? `Notes saved with ${files.length} photo${files.length === 1 ? "" : "s"} filed.`
          : "The session was marked done.",
      });
      onClose();
      setNotes("");
      setOutcome("");
      setFollowDate("");
      setFollowTime("");
      setFiles([]);
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
            Record what happened. Photos are optional — file them now or later from the session list.
          </DialogDescription>
        </DialogHeader>
        {notStarted ? (
          <div className={styles.errorBlock} role="alert">
            <p className={styles.errorText}>
              This session hasn&apos;t started yet — you can mark it done once the scheduled time arrives.
            </p>
          </div>
        ) : null}
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
          <div className={styles.formFull}>
            <Label htmlFor="nurse-done-files">Documentation photos (optional)</Label>
            <Input
              id="nurse-done-files"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => onPickFiles(e.target.files)}
            />
            <p style={{ fontSize: "0.8125rem", opacity: 0.75, marginTop: "0.25rem" }}>
              {files.length === 0
                ? "Wound photo, referral slip, lab result… JPG/PNG/WEBP, max 5 at a time, 5 MB each. You can skip this."
                : `${files.length} photo${files.length === 1 ? "" : "s"} selected: ${files.map((f) => f.name).join(", ")}`}
            </p>
          </div>
        </div>
        {error ? (<div className={styles.errorBlock} role="alert"><p className={styles.errorText}>{error}</p></div>) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={acting || notStarted}>
            {acting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Mark done
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
            {acting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Move session
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
            {acting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Cancel session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteSessionDialog({
  referralId,
  session,
  open,
  onClose,
  onChanged,
}: DialogProps & { referralId: string; session: NurseSessionItem }) {
  const [acting, setActing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!open) return null;

  async function remove() {
    setError(null);
    setActing(true);
    try {
      await deleteClinicSession(referralId, session.id);
      toast.success({ title: "Session deleted", description: "The cancelled session was removed." });
      onClose();
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not delete the session. Try again."));
    } finally {
      setActing(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) { onClose(); setError(null); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete cancelled session?</DialogTitle>
          <DialogDescription>
            This permanently removes the cancelled session from the list. The case itself stays open. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error ? (<div className={styles.errorBlock} role="alert"><p className={styles.errorText}>{error}</p></div>) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={() => void remove()} disabled={acting}>
            {acting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Delete session
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

  // Proper clinic close-out: review → accept → ≥1 completed session → done.
  // Docs stay optional — only the completed session gates Done.
  const completed = row.sessions.filter((s) => s.status === "completed").length;
  const docCount = row.sessions.reduce((n, s) => n + (s.attachments?.length ?? 0), 0);
  const canResolve = completed > 0;

  async function save() {
    if (!canResolve) {
      setError("Finish at least one clinic session before marking this case done — schedule one, mark it done, then come back.");
      return;
    }
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
            Step 4 — close {row.student}&rsquo;s case. A closing summary is optional but recommended.
          </DialogDescription>
        </DialogHeader>
        <div className={styles.formGrid}>
          <div className={styles.formFull}>
            <div className={styles.errorBlock} style={{ borderStyle: "solid" }} aria-live="polite">
              <p className={styles.errorText} style={{ fontWeight: 600 }}>
                {canResolve
                  ? `Ready to close — ${completed} session${completed === 1 ? "" : "s"} done${docCount > 0 ? ` · ${docCount} photo${docCount === 1 ? "" : "s"} filed` : " · no photos filed (optional)"}.`
                  : "Not ready yet — finish at least one clinic session first. Photos are optional."}
              </p>
            </div>
          </div>
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
          <Button onClick={() => void save()} disabled={acting || !canResolve}>
            {acting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Finish & close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Optional documentation on one clinic session: view filed photos, attach
 * more, or remove a wrong upload. Never gates Done — purely the evidence
 * trail. Available on open cases from the session list ("Docs" button).
 */
export function SessionDocsDialog({
  referralId,
  session,
  open,
  onClose,
  onChanged,
}: DialogProps & { referralId: string; session: NurseSessionItem }) {
  const [docs, setDocs] = React.useState<ClinicAttachment[]>(session.attachments ?? []);
  const [uploading, setUploading] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const now = useNowTick(open);

  if (!open) return null;

  // Documentation unlocks once the session time arrives — viewing stays
  // allowed, but new uploads wait for an ongoing/completed session.
  const docsLocked =
    session.status === "scheduled" &&
    new Date(session.scheduledAt).getTime() > now;

  async function onPick(list: FileList | null) {
    if (!list) return;
    if (docsLocked) {
      setError("This session hasn't started yet — you can file documentation once the scheduled time arrives.");
      return;
    }
    const picked = Array.from(list).slice(0, 5);
    const problem = clinicAttachmentError(picked);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const added = await uploadClinicAttachments(referralId, session.id, picked);
      setDocs((prev) => [...prev, ...added]);
      toast.success({
        title: "Photos filed",
        description: `${added.length} photo${added.length === 1 ? "" : "s"} attached to this session.`,
      });
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not upload the photos. Try again."));
    } finally {
      setUploading(false);
    }
  }

  async function onRemove(id: string) {
    setError(null);
    setRemovingId(id);
    try {
      await deleteClinicAttachment(referralId, session.id, id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not remove that photo. Try again."));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) { onClose(); setError(null); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Session documentation</DialogTitle>
          <DialogDescription>
            Optional photos for this session — wound, slip, lab result… JPG/PNG/WEBP, 5 MB each.
          </DialogDescription>
        </DialogHeader>
        {docsLocked ? (
          <div className={styles.errorBlock} role="alert">
            <p className={styles.errorText}>
              This session hasn&apos;t started yet — filing unlocks once the scheduled time arrives. Filed photos below stay viewable.
            </p>
          </div>
        ) : null}
        {docs.length === 0 ? (
          <p style={{ fontSize: "0.875rem", opacity: 0.75 }}>No photos filed yet.</p>
        ) : (
          <ul style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(auto-fill, minmax(7rem, 1fr))", listStyle: "none", padding: 0, margin: 0 }}>
            {docs.map((d) => (
              <li key={d.id} style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: "0.5rem", overflow: "hidden" }}>
                <a href={d.fileUrl} target="_blank" rel="noreferrer" aria-label={`Open ${d.fileName}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.fileUrl} alt={d.fileName} style={{ width: "100%", height: "5.5rem", objectFit: "cover", display: "block" }} />
                </a>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.25rem", padding: "0.25rem 0.375rem" }}>
                  <span style={{ fontSize: "0.6875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.fileName}>
                    {d.fileName}
                  </span>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    disabled={removingId === d.id}
                    onClick={() => void onRemove(d.id)}
                    aria-label={`Remove ${d.fileName}`}
                  >
                    {removingId === d.id ? <Loader2 className="animate-spin" aria-hidden /> : null}
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.formGrid}>
          <div className={styles.formFull}>
            <Label htmlFor={`nurse-docs-${session.id}`}>Attach photos (optional)</Label>
            <Input
              id={`nurse-docs-${session.id}`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={uploading || docsLocked}
              onChange={(e) => void onPick(e.target.files)}
            />
          </div>
        </div>
        {error ? (<div className={styles.errorBlock} role="alert"><p className={styles.errorText}>{error}</p></div>) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * ADM referral form as a modal (no page navigation): the nurse answers the
 * form, then Confirm referral saves the form AND endorses the case to the
 * ADM coordinator in one action. The dialog stays on the referrals page —
 * nothing redirects. If endorsing fails after the save, retrying Confirm is
 * safe (re-saving while pending just refreshes the answers).
 */
export function NurseReferralFormModal({
  row,
  initialRecommendation = "",
  initialScheduledAt,
  open,
  onClose,
  onChanged,
}: DialogProps & {
  row: NurseQueueRow;
  initialRecommendation?: string;
  initialScheduledAt?: string;
}) {
  const [recommendation, setRecommendation] = React.useState(initialRecommendation);
  const [concerns, setConcerns] = React.useState<Record<string, boolean>>({});
  const [othersText, setOthersText] = React.useState("");
  const [details, setDetails] = React.useState(
    row.anecdotal && row.anecdotal.incident !== "—" ? row.anecdotal.incident : ""
  );
  const [actions, setActions] = React.useState("");
  const [followUp, setFollowUp] = React.useState("");
  const [sessionDate, setSessionDate] = React.useState(
    initialScheduledAt ? initialScheduledAt.slice(0, 10) : ""
  );
  const [sessionTime, setSessionTime] = React.useState(
    initialScheduledAt ? initialScheduledAt.slice(11, 16) : ""
  );
  const [acting, setActing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!open) return null;

  const hasActive = row.sessions.some((s) => s.status === "scheduled");

  function resolveSession(): string | undefined {
    if (!sessionDate && !sessionTime) return undefined;
    if (!sessionDate || !sessionTime) {
      setError("Pick both a date and a time for the clinic session — or leave both empty to endorse without one.");
      return null as unknown as undefined;
    }
    const at = new Date(`${sessionDate}T${sessionTime}:00`);
    if (Number.isNaN(at.getTime())) {
      setError("Pick a valid date and time for the clinic session.");
      return null as unknown as undefined;
    }
    if (at.getTime() <= Date.now()) {
      setError("Clinic session must be set in the future.");
      return null as unknown as undefined;
    }
    return `${sessionDate}T${sessionTime}:00`;
  }

  async function confirm() {
    if (!recommendation.trim()) {
      setError("Write your recommendation first — the coordinator needs it.");
      return;
    }
    const scheduledAt = resolveSession();
    if (scheduledAt === (null as unknown as undefined)) return;
    if (scheduledAt && hasActive) {
      setError("This referral already has a session that is not done yet — finish or cancel it before booking another one.");
      return;
    }
    const checked = CONCERN_OPTIONS.filter((c) => concerns[c.key]);
    const form: NurseAdmReferralForm = {
      ...(checked.length > 0
        ? {
            concerns: checked.map((c) =>
              c.key === "others" && othersText.trim()
                ? `Others: ${othersText.trim()}`
                : c.label
            ),
          }
        : {}),
      ...(details.trim() ? { detailsOfConcern: details.trim().slice(0, 2000) } : {}),
      ...(actions.trim() ? { nurseActions: actions.trim().slice(0, 2000) } : {}),
      ...(followUp.trim() ? { followUp: followUp.trim().slice(0, 2000) } : {}),
    };
    setError(null);
    setActing(true);
    try {
      await confirmNurseReferralAndEndorse(row.id, {
        recommendation: recommendation.trim(),
        ...(scheduledAt ? { scheduledAt } : {}),
        referralForm: form,
      });
      toast.success({
        title: "Referral confirmed",
        description: `${row.student}'s case was endorsed to the ADM coordinator.`,
      });
      onClose();
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not confirm this referral. Try again — retrying is safe."));
    } finally {
      setActing(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) { onClose(); setError(null); } }}>
      <DialogContent style={{ maxHeight: "85vh", overflowY: "auto" }}>
        <DialogHeader>
          <DialogTitle>Referral form — {row.student}</DialogTitle>
          <DialogDescription>
            {row.lrn} · {row.section}{row.grade && row.grade !== "—" ? ` · ${row.grade}` : ""}.
            Confirming saves this form and endorses the case to the ADM coordinator at once.
          </DialogDescription>
        </DialogHeader>
        <div className={styles.formGrid}>
          <div className={styles.formFull}>
            <Label htmlFor={`nurse-rf-rec-${row.id}`}>Recommendation (required)</Label>
            <Textarea
              id={`nurse-rf-rec-${row.id}`}
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="Should this student enter ADM? Why…"
              maxLength={500}
            />
          </div>
          <div className={styles.formFull}>
            <p className={styles.blockLabel}>Concerns — check all that apply</p>
            <div style={{ display: "grid", gap: "0.375rem", marginTop: "0.375rem" }}>
              {CONCERN_OPTIONS.map((c) => (
                <label key={c.key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
                  <Checkbox
                    checked={concerns[c.key] === true}
                    onCheckedChange={(v) =>
                      setConcerns((prev) => ({ ...prev, [c.key]: v === true }))
                    }
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
            {concerns.others ? (
              <div style={{ marginTop: "0.5rem" }}>
                <Label htmlFor={`nurse-rf-others-${row.id}`}>Others — specify</Label>
                <Input
                  id={`nurse-rf-others-${row.id}`}
                  value={othersText}
                  onChange={(e) => setOthersText(e.target.value)}
                  placeholder="Specify the other concern…"
                  maxLength={50}
                />
              </div>
            ) : null}
          </div>
          <div className={styles.formFull}>
            <Label htmlFor={`nurse-rf-details-${row.id}`}>Details of concern</Label>
            <Textarea
              id={`nurse-rf-details-${row.id}`}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="What was observed…"
              maxLength={2000}
              rows={3}
            />
          </div>
          <div className={styles.formFull}>
            <Label htmlFor={`nurse-rf-actions-${row.id}`}>Actions taken</Label>
            <Textarea
              id={`nurse-rf-actions-${row.id}`}
              value={actions}
              onChange={(e) => setActions(e.target.value)}
              placeholder="What did you do or advise…"
              maxLength={2000}
              rows={3}
            />
          </div>
          <div className={styles.formFull}>
            <Label htmlFor={`nurse-rf-follow-${row.id}`}>Follow-up plan</Label>
            <Textarea
              id={`nurse-rf-follow-${row.id}`}
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              placeholder="What happens next…"
              maxLength={2000}
              rows={2}
            />
          </div>
          <ClinicDatePicker id={`nurse-rf-date-${row.id}`} label="Clinic session date (optional)" value={sessionDate} onChange={setSessionDate} min={todayKey()} />
          <ClinicTimePicker id={`nurse-rf-time-${row.id}`} label="Clinic session time (optional)" value={sessionTime} onChange={setSessionTime} />
          {hasActive ? (
            <p className={styles.blockLabel} style={{ gridColumn: "1 / -1" }}>
              A session that is not done yet is already booked on this case — leave the session empty, or finish/cancel the existing one first.
            </p>
          ) : null}
        </div>
        {error ? (<div className={styles.errorBlock} role="alert"><p className={styles.errorText}>{error}</p></div>) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void confirm()} disabled={acting}>
            {acting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Confirm referral
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Map saved concern labels back onto the template's checkboxes. "Others: …"
   and unknown labels land in the Others text so nothing saved is lost. */
function savedConcernsRecord(labels: string[]): GcForm03Data["concerns"] {
  const record: GcForm03Data["concerns"] = {
    absences: false,
    academic: false,
    personal: false,
    family: false,
    peer: false,
    others: false,
    othersText: "",
  };
  const extras: string[] = [];
  for (const label of labels) {
    if (label.startsWith("Others:")) {
      record.others = true;
      const text = label.slice("Others:".length).trim();
      if (text) extras.push(text);
      continue;
    }
    const opt = CONCERN_OPTIONS.find((c) => c.label === label);
    if (opt && opt.key !== "others") {
      record[opt.key] = true;
    } else if (opt) {
      record.others = true;
    } else {
      record.others = true;
      extras.push(label);
    }
  }
  if (extras.length > 0) record.othersText = extras.join(", ");
  return record;
}

/**
 * Read-only view of a confirmed referral form: the saved answers are
 * autofilled onto the official GCForm-03 template (the same sheet preview
 * the confirm flow shows) — nothing here is editable because the fill-up is
 * done. For the rare form-ready case that is still pending (saved before
 * auto-endorse existed), the footer offers Confirm & endorse instead.
 */
export function NurseReferralFormViewModal({
  row,
  open,
  onClose,
  onChanged,
}: DialogProps & { row: NurseQueueRow }) {
  const [built, setBuilt] = React.useState<GcForm03Data | null>(null);
  const [sheetHtml, setSheetHtml] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const [endorsing, setEndorsing] = React.useState(false);
  const [endorseError, setEndorseError] = React.useState<string | null>(null);

  // Legacy state only: saved (form ready) but never forwarded, because the
  // save predates auto-endorse. New confirms never land here.
  const needsEndorse = row.status === "pending" && row.referralReady;

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Fresh mount per case (caller keys by row id), so the initial nulls
    // above already render the loading state — no sync resets here.
    void (async () => {
      try {
        const saved = parseSavedNurseAdmForm(row.notes);
        let report = null;
        if (row.anecdotalId) {
          try {
            report = await fetchOcForm01Detail(row.anecdotalId);
          } catch {
            report = null;
          }
        }
        const adapter: GuidanceAdmCase = {
          id: row.id,
          student: row.student,
          lrn: row.lrn,
          section: row.section,
          grade: row.grade,
          stage: "consultation",
          stageLabel: "Consultation and referral",
          eligibility: "pending",
          referralId: row.id,
          referralStatus: row.status,
          reason: row.reason,
          referredBy: "",
          preparedBy: "",
          date: row.date,
          meetingAttended: null,
          hasHomeVisit: false,
          approved: false,
          approvedAt: null,
          anecdotalId: row.anecdotalId ?? undefined,
          category: row.category,
          anecdotalExcerpt: row.anecdotal?.incident ?? "",
          recommendations: row.anecdotal?.notes ?? "",
        };
        const base = buildGcForm03Data(adapter, report, saved?.recommendation ?? "", "");
        const data: GcForm03Data = saved
          ? {
              ...base,
              concerns: savedConcernsRecord(saved.concerns),
              detailsOfConcern: saved.details || base.detailsOfConcern,
              referrerActions: saved.actions
                ? [
                    { date: row.date, action: saved.actions },
                    { date: "", action: "" },
                    { date: "", action: "" },
                  ]
                : base.referrerActions,
              guidanceRecommendations: saved.recommendation || base.guidanceRecommendations,
              followUp: saved.followUp || base.followUp,
            }
          : base;
        const [{ buildFilledGcForm03Workbook }, { renderGcForm03SheetHtml }] =
          await Promise.all([
            import("@/app/guidance/adm/components/gcform03-workbook"),
            import("@/app/guidance/adm/components/gcform03-sheet-html"),
          ]);
        const wb = await buildFilledGcForm03Workbook(data);
        if (!cancelled) {
          setBuilt(data);
          setSheetHtml(renderGcForm03SheetHtml(wb));
        }
      } catch {
        if (!cancelled) {
          setLoadError("The referral form could not be prepared. Check your connection and try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, row]);

  if (!open) return null;

  async function download() {
    if (!built || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const { downloadGcForm03 } = await import(
        "@/app/guidance/adm/components/gcform03-workbook"
      );
      await downloadGcForm03(built);
    } catch {
      setDownloadError("The .xlsx could not be prepared. Check your connection and try again.");
    } finally {
      setDownloading(false);
    }
  }

  async function endorse() {
    setEndorseError(null);
    setEndorsing(true);
    try {
      await forwardNurseAdmCase(row.id);
      toast.success({
        title: "Case endorsed",
        description: `${row.student}'s case moves to the ADM coordinator.`,
      });
      onClose();
      onChanged();
    } catch (err) {
      setEndorseError(apiErrorMessage(err, "Could not endorse this case. Try again."));
    } finally {
      setEndorsing(false);
    }
  }

  const loading = !sheetHtml && !loadError;

  return (
    <Dialog open onOpenChange={(next) => { if (!next) { onClose(); } }}>
      <DialogContent style={{ maxWidth: 900, maxHeight: "90vh", overflowY: "auto" }}>
        <DialogHeader>
          <DialogTitle>Referral form — {row.student}</DialogTitle>
          <DialogDescription>
            {needsEndorse
              ? "Saved answers, autofilled on the official template. Confirm below to endorse to the ADM coordinator."
              : "Confirmed referral, autofilled on the official template. Read-only."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col gap-2 py-4" aria-busy="true">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-[55%]" />
          </div>
        ) : null}
        {loadError ? (
          <p className={styles.errorText} role="alert">{loadError}</p>
        ) : null}
        {sheetHtml ? (
          <div
            className={`gcform03-print-sheet ${sheetStyles.sheetWrap}`}
            dangerouslySetInnerHTML={{ __html: sheetHtml }}
          />
        ) : null}

        {downloadError ? (
          <p className={styles.errorText} role="alert">{downloadError}</p>
        ) : null}
        {endorseError ? (
          <p className={styles.errorText} role="alert">{endorseError}</p>
        ) : null}

        <DialogFooter>
          <div className="flex gap-2 justify-end pt-4 print:hidden" style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", width: "100%" }}>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              disabled={!built || !sheetHtml}
            >
              <Printer aria-hidden />
              Print
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!built || downloading}
              onClick={() => void download()}
            >
              <Download aria-hidden />
              {downloading ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Download .xlsx
            </Button>
            {needsEndorse ? (
              <Button type="button" size="sm" disabled={endorsing} onClick={() => void endorse()}>
                {endorsing ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Confirm & endorse
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

