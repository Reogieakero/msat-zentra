"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { FolderCard } from "@/components/ui/FolderCard";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { ClinicDatePicker, ClinicTimePicker } from "./ClinicDateTimePicker";
import {
  apiErrorMessage,
  reviewNurseAdmCase,
  saveNurseReferralDraft,
  scheduleClinicSession,
  type NurseQueueRow,
} from "./nurse-overview-data";
import styles from "./nurse-overview.module.css";

/**
 * ADM consultation review for cases the adviser routed to the nurse.
 * Review here, then Create referral opens the referral form — as a modal
 * when the caller passes onCreateReferral (referrals page, no navigation),
 * otherwise the dedicated referral form page
 * (/nurse/adm/referral/[referralId]). Reject (turn down) closes the case
 * straight from this dialog. "Start handling" stays clinic-only — this
 * dialog is the nurse's pipeline path for ADM cases.
 */
export function NurseAdmReviewDialog({
  row,
  onChanged,
  onCreateReferral,
}: {
  row: NurseQueueRow;
  onChanged: () => void;
  // When provided, Create referral hands the typed recommendation + optional
  // session to the caller (modal flow) instead of navigating to the form page.
  onCreateReferral?: (draft: { recommendation: string; scheduledAt?: string }) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [recommendation, setRecommendation] = React.useState("");
  const [sessionDate, setSessionDate] = React.useState("");
  const [sessionTime, setSessionTime] = React.useState("");
  const [acting, setActing] = React.useState(false);
  const [booking, setBooking] = React.useState(false);
  // Which footer action is awaiting confirmation in the confirm dialog.
  const [confirmFor, setConfirmFor] = React.useState<null | "book" | "reject" | "create">(null);
  const [error, setError] = React.useState<string | null>(null);
  const [previewId, setPreviewId] = React.useState<string | null>(null);

  function todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function openDialog() {
    setRecommendation("");
    setSessionDate("");
    setSessionTime("");
    setError(null);
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setError(null);
  }

  // Create-referral gate: recommendation is mandatory; an optional session
  // must be fully specified and in the future. With a modal handoff the
  // draft goes straight to the form modal; otherwise it travels via
  // sessionStorage to the dedicated form page.
  function goToReferralForm() {
    if (!recommendation.trim()) {
      setError("Write your recommendation first — the coordinator needs it.");
      return;
    }
    let scheduledAt: string | undefined;
    if (sessionDate || sessionTime) {
      if (!sessionDate || !sessionTime) {
        setError("Pick both a date and a time for the clinic session — or leave both empty to forward without one.");
        return;
      }
      const at = new Date(`${sessionDate}T${sessionTime}:00`);
      if (Number.isNaN(at.getTime())) {
        setError("Pick a valid date and time for the clinic session.");
        return;
      }
      if (at.getTime() <= Date.now()) {
        setError("Clinic session must be set in the future.");
        return;
      }
      scheduledAt = `${sessionDate}T${sessionTime}:00`;
    }
    if (scheduledAt && row.sessions.some((s) => s.status === "scheduled")) {
      setError("This referral already has a session that is not done yet — finish or cancel it before booking another one.");
      return;
    }
    setError(null);
    const draft = { recommendation: recommendation.trim(), ...(scheduledAt ? { scheduledAt } : {}) };
    setOpen(false);
    if (onCreateReferral) {
      onCreateReferral(draft);
      return;
    }
    saveNurseReferralDraft(draft);
    router.push(`/nurse/adm/referral/${encodeURIComponent(row.id)}`);
  }

  // Footer buttons validate first (inline error, no popup), then ask for
  // confirmation in the confirm dialog. The actual work runs only after
  // confirming, with a spinner on the acting button.
  function askBook() {
    if (!sessionDate || !sessionTime) {
      setError("Pick a date and a time first — or leave both empty and carry the session into the referral form instead.");
      return;
    }
    setError(null);
    setConfirmFor("book");
  }

  function askReject() {
    if (!recommendation.trim()) {
      setError("Write your recommendation first — the coordinator needs it.");
      return;
    }
    setError(null);
    setConfirmFor("reject");
  }

  function askCreate() {
    if (!recommendation.trim()) {
      setError("Write your recommendation first — the coordinator needs it.");
      return;
    }
    setError(null);
    setConfirmFor("create");
  }

  // Standalone booking: schedule the clinic session WITHOUT deciding the
  // case — it stays pending until the nurse confirms the referral or turns
  // it down. The dialog stays open so review can continue. One active
  // session per referral: booking waits while a scheduled session exists.
  async function bookSessionOnly() {
    if (row.sessions.some((s) => s.status === "scheduled")) {
      setError("This referral already has a session that is not done yet — finish or cancel it before booking another one.");
      return;
    }
    if (!sessionDate || !sessionTime) {
      setError("Pick a date and a time first — or leave both empty and carry the session into the referral form instead.");
      return;
    }
    const at = new Date(`${sessionDate}T${sessionTime}:00`);
    if (Number.isNaN(at.getTime())) {
      setError("Pick a valid date and time for the clinic session.");
      return;
    }
    if (at.getTime() <= Date.now()) {
      setError("Clinic session must be set in the future.");
      return;
    }
    setError(null);
    setBooking(true);
    try {
      await scheduleClinicSession(row.id, {
        scheduledAt: `${sessionDate}T${sessionTime}:00`,
      });
      toast.success({
        title: "Session booked",
        description: `${row.student}'s case stays pending until you confirm the referral.`,
      });
      setSessionDate("");
      setSessionTime("");
      // The confirm dialog stays open with the spinner until booking
      // finishes — only then does it close back to the review.
      setConfirmFor(null);
      onChanged();
    } catch (err) {
      setConfirmFor(null);
      setError(apiErrorMessage(err, "Could not book the session. Try again."));
    } finally {
      setBooking(false);
    }
  }

  async function decideReject() {
    if (!recommendation.trim()) {
      setConfirmFor(null);
      setError("Write your recommendation first — the coordinator needs it.");
      return;
    }
    setError(null);
    setActing(true);
    try {
      await reviewNurseAdmCase(row.id, { recommendation: recommendation.trim(), outcome: "reject" });
      toast.success({
        title: "Case rejected",
        description: `${row.student}'s case was closed without ADM follow-through.`,
      });
      setConfirmFor(null);
      closeDialog();
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not submit your review. Try again."));
    } finally {
      setActing(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="xs" style={{ height: "32px" }} onClick={openDialog}>
        Review ADM case
      </Button>

      {open && (
        <Dialog
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) closeDialog();
          }}
        >
          <DialogContent
            className={styles.dialogScrollHidden}
            style={{ maxWidth: "36rem", maxHeight: "90vh", overflowY: "auto" }}
          >
            <DialogHeader>
              <DialogTitle>Review ADM case</DialogTitle>
              <DialogDescription>
                Review {row.student}&rsquo;s case, write your recommendation, then create the
                referral form — confirming it endorses the case to the ADM coordinator
                at once. Or reject it.
              </DialogDescription>
            </DialogHeader>
            <dl className={styles.intakeSummary}>
              <div className={styles.intakeRow}>
                <dt className={styles.intakeLabel}>Name</dt>
                <dd className={styles.intakeValue}>{row.student}</dd>
              </div>
              <div className={styles.intakeRow}>
                <dt className={styles.intakeLabel}>LRN</dt>
                <dd className={styles.intakeValue}>{row.lrn}</dd>
              </div>
              <div className={styles.intakeRow}>
                <dt className={styles.intakeLabel}>Section</dt>
                <dd className={styles.intakeValue}>
                  {row.section} · {row.grade}
                </dd>
              </div>
              <div className={styles.intakeRow}>
                <dt className={styles.intakeLabel}>Observed</dt>
                <dd className={styles.intakeValue}>
                  {row.anecdotal?.observedAt ?? "—"} · {row.anecdotal?.category ?? row.category}
                </dd>
              </div>
              <div className={styles.intakeRow}>
                <dt className={styles.intakeLabel}>Referred</dt>
                <dd className={styles.intakeValue}>
                  {row.date}
                  {row.waitingDays !== null && row.waitingDays > 0 ? ` · waiting ${row.waitingDays}d` : ""}
                </dd>
              </div>
            </dl>
            <div className={styles.dialogField}>
              <Label>Official report</Label>
              {row.anecdotalId ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setPreviewId(row.anecdotalId)}
                    aria-label={`Open the official anecdotal report for ${row.student}`}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                  >
                    <FolderCard
                      label={row.student}
                      sublabel={`${row.lrn} · ${row.anecdotal?.observedAt ?? row.date}`}
                      files={[
                        {
                          name: `OCForm-01_${row.anecdotal?.observedAt ?? row.date}`,
                          tag: `${row.anecdotal?.category ?? row.category} · tap to preview`,
                          icon: "doc" as const,
                        },
                      ]}
                    />
                  </button>
                </div>
              ) : (
                <p className={styles.dialogHint}>No official report attached to this case.</p>
              )}
            </div>
            <div className={styles.dialogField}>
              <span className={styles.dialogLabel}>Clinic session (optional)</span>
              <div className={styles.sessionGrid}>
                <ClinicDatePicker
                  id={`adm-session-date-${row.id}`}
                  label="Date"
                  value={sessionDate}
                  onChange={setSessionDate}
                  min={todayKey()}
                />
                <ClinicTimePicker
                  id={`adm-session-time-${row.id}`}
                  label="Time"
                  value={sessionTime}
                  onChange={setSessionTime}
                />
              </div>
              {row.sessions.some((s) => s.status === "scheduled") ? (
                <p className={styles.dialogError} role="note">
                  A session that is not done yet is already booked on this case — finish or cancel it before booking another one.
                </p>
              ) : (
                <p className={styles.dialogHint}>Held at the school clinic. Book it now without deciding, or carry it into the referral form.</p>
              )}
            </div>
            <div className={styles.dialogField}>
              <Label htmlFor={`adm-rec-${row.id}`}>Your recommendation (required)</Label>
              <Textarea
                id={`adm-rec-${row.id}`}
                className={styles.dialogTextarea}
                placeholder="Should this student enter ADM? Why…"
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                maxLength={500}
              />
            </div>
            {error ? <p className={styles.dialogError}>{error}</p> : null}
            <DialogFooter>
              <Button variant="outline" onClick={askBook} disabled={acting || booking}>
                {booking ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Book session
              </Button>
              <Button
                variant="destructive"
                style={{ backgroundColor: "#dc2626", borderColor: "#dc2626", color: "#ffffff" }}
                onClick={askReject}
                disabled={acting || booking}
              >
                {acting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Reject
              </Button>
              <Button onClick={askCreate} disabled={acting || booking}>
                Create referral…
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {confirmFor && (
        <Dialog
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) setConfirmFor(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {confirmFor === "book"
                  ? "Book this session?"
                  : confirmFor === "reject"
                    ? "Reject this case?"
                    : "Create referral?"}
              </DialogTitle>
              <DialogDescription>
                {confirmFor === "book" ? (
                  <>A clinic session will be scheduled for {row.student}. The case stays pending until you confirm the referral or reject it.</>
                ) : confirmFor === "reject" ? (
                  <>{row.student}&rsquo;s case will be closed without ADM follow-through — the coordinator never receives it. This can&apos;t be undone.</>
                ) : (
                  <>Open the referral form with your recommendation carried over. Confirming there endorses the case to the ADM coordinator at once.</>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmFor(null)} disabled={acting || booking}>
                Cancel
              </Button>
              {confirmFor === "book" ? (
                <Button onClick={() => void bookSessionOnly()} disabled={booking}>
                  {booking ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  Yes, book
                </Button>
              ) : confirmFor === "reject" ? (
                <Button
                  variant="destructive"
                  style={{ backgroundColor: "#dc2626", borderColor: "#dc2626", color: "#ffffff" }}
                  onClick={() => void decideReject()}
                  disabled={acting}
                >
                  {acting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  Yes, reject
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setConfirmFor(null);
                    goToReferralForm();
                  }}
                >
                  Continue
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {previewId && (
        <OcForm01PreviewDialog recordId={previewId} onClose={() => setPreviewId(null)} />
      )}
    </>
  );
}
