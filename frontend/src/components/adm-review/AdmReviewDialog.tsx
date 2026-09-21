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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FolderCard } from "@/components/ui/FolderCard";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { ClinicDatePicker, ClinicTimePicker } from "@/app/nurse/overview/components/ClinicDateTimePicker";
import styles from "./adm-review-dialog.module.css";

/* Handoff to the caller when Create referral is confirmed: the typed
   recommendation plus the optional session the reviewer picked. */
export interface AdmReviewDraft {
  recommendation: string;
  scheduledAt?: string;
}

/* Per-desk wording overrides — defaults match the nurse modal. */
export interface AdmReviewCopy {
  askBookEmpty: string;
  recommendationRequired: string;
  incompleteSession: string;
  invalidSession: string;
  pastSession: string;
  activeSessionExists: string;
  bookFailed: string;
  rejectFailed: string;
}

export const DEFAULT_ADM_REVIEW_COPY: AdmReviewCopy = {
  askBookEmpty:
    "Pick a date and a time first — or leave both empty and carry on with the review instead.",
  recommendationRequired:
    "Write your recommendation first — the coordinator needs it.",
  incompleteSession:
    "Pick both a date and a time for the session — or leave both empty.",
  invalidSession: "Pick a valid date and time for the session.",
  pastSession: "Session must be set in the future.",
  activeSessionExists:
    "This case already has a session that is not done yet — finish or cancel it before booking another one.",
  bookFailed: "Could not book the session. Try again.",
  rejectFailed: "Could not reject this case. Try again.",
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Shared ADM consultation review dialog (nurse + guidance desks, same UI):
 * intake summary, official report folder, optional session (date + time),
 * recommendation, then Reject / Book session / Create referral with
 * confirmations. Action buttons keep their labels and show a spinner
 * while running. The caller implements the API calls (booking, reject,
 * referral handoff) and any toasts/refreshes around them.
 */
export function AdmReviewDialog({
  open,
  onClose,
  student,
  lrn,
  sectionLine,
  observed,
  category,
  referred,
  anecdotalId,
  description,
  sessionSectionLabel,
  sessionFieldHint,
  recommendationPlaceholder,
  sessionNoun,
  createConfirmHint,
  hasActiveSession,
  copy: copyOverrides,
  formatError,
  onBookSession,
  onReject,
  onCreateReferral,
}: {
  open: boolean;
  onClose: () => void;
  student: string;
  lrn: string;
  sectionLine: string;
  observed: string;
  category: string;
  referred: string;
  anecdotalId: string | null;
  description: React.ReactNode;
  sessionSectionLabel: string;
  sessionFieldHint: string;
  recommendationPlaceholder: string;
  sessionNoun: "clinic" | "counseling";
  createConfirmHint?: string;
  hasActiveSession: boolean;
  copy?: Partial<AdmReviewCopy>;
  formatError?: (err: unknown, fallback: string) => string;
  onBookSession: (scheduledAt: string) => Promise<void>;
  onReject: (recommendation: string) => Promise<void>;
  onCreateReferral: (draft: AdmReviewDraft) => void;
}) {
  const copy: AdmReviewCopy = { ...DEFAULT_ADM_REVIEW_COPY, ...copyOverrides };
  const [recommendation, setRecommendation] = React.useState("");
  const [sessionDate, setSessionDate] = React.useState("");
  const [sessionTime, setSessionTime] = React.useState("");
  const [acting, setActing] = React.useState(false);
  const [booking, setBooking] = React.useState(false);
  const [confirmFor, setConfirmFor] = React.useState<null | "book" | "reject" | "create">(null);
  const [blockedOpen, setBlockedOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [previewId, setPreviewId] = React.useState<string | null>(null);

  /* Fresh form on every open — no stale recommendation/session carried over.
     Synced during render keyed by open (never in an effect). */
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open && !prevOpen) {
    setPrevOpen(true);
    setRecommendation("");
    setSessionDate("");
    setSessionTime("");
    setError(null);
    setConfirmFor(null);
    setBlockedOpen(false);
    setPreviewId(null);
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  if (!open) return null;

  function fail(err: unknown, fallback: string) {
    setError(formatError ? formatError(err, fallback) : fallback);
  }

  function resolveSession(): string | null | undefined {
    if (!sessionDate && !sessionTime) return undefined;
    if (!sessionDate || !sessionTime) {
      setError(copy.incompleteSession);
      return null;
    }
    const at = new Date(`${sessionDate}T${sessionTime}:00`);
    if (Number.isNaN(at.getTime())) {
      setError(copy.invalidSession);
      return null;
    }
    if (at.getTime() <= Date.now()) {
      setError(copy.pastSession);
      return null;
    }
    return `${sessionDate}T${sessionTime}:00`;
  }

  // Footer buttons validate first (inline error, no popup), then ask for
  // confirmation in the confirm dialog. The actual work runs only after
  // confirming, with a spinner on the acting button.
  function askBook() {
    if (!sessionDate || !sessionTime) {
      setError(copy.askBookEmpty);
      return;
    }
    setError(null);
    setConfirmFor("book");
  }

  function askReject() {
    if (!recommendation.trim()) {
      setError(copy.recommendationRequired);
      return;
    }
    setError(null);
    setConfirmFor("reject");
  }

  function askCreate() {
    // Detector first: create referral cannot be bypassed while an upcoming
    // session (or follow-up) still has to be done — pop an explanatory
    // dialog instead of proceeding.
    if (hasActiveSession) {
      setBlockedOpen(true);
      return;
    }
    if (!recommendation.trim()) {
      setError(copy.recommendationRequired);
      return;
    }
    setError(null);
    setConfirmFor("create");
  }

  // Standalone booking: schedule the session WITHOUT deciding the case —
  // it stays pending. On success every modal auto-closes (review +
  // confirm) with a single success toast from the caller. One active
  // session per referral.
  async function bookSessionOnly() {
    // Idempotency: rapid double-clicks on the confirm button issue one
    // request — the disabled state flips only after re-render.
    if (booking || acting) return;
    if (hasActiveSession) {
      setConfirmFor(null);
      setError(copy.activeSessionExists);
      return;
    }
    const scheduledAt = resolveSession();
    if (!scheduledAt) {
      setConfirmFor(null);
      return;
    }
    setError(null);
    setBooking(true);
    try {
      await onBookSession(scheduledAt);
      setSessionDate("");
      setSessionTime("");
      setConfirmFor(null);
      onClose();
    } catch (err) {
      setConfirmFor(null);
      fail(err, copy.bookFailed);
    } finally {
      setBooking(false);
    }
  }

  async function decideReject() {
    // Idempotency: see bookSessionOnly.
    if (acting || booking) return;
    if (!recommendation.trim()) {
      setConfirmFor(null);
      setError(copy.recommendationRequired);
      return;
    }
    setError(null);
    setActing(true);
    try {
      await onReject(recommendation.trim());
      setConfirmFor(null);
      onClose();
    } catch (err) {
      fail(err, copy.rejectFailed);
    } finally {
      setActing(false);
    }
  }

  function goToReferralForm() {
    if (!recommendation.trim()) {
      setConfirmFor(null);
      setError(copy.recommendationRequired);
      return;
    }
    const scheduledAt = resolveSession();
    if (scheduledAt === null) {
      setConfirmFor(null);
      return;
    }
    if (scheduledAt && hasActiveSession) {
      setConfirmFor(null);
      setError(copy.activeSessionExists);
      return;
    }
    setError(null);
    setConfirmFor(null);
    onCreateReferral({
      recommendation: recommendation.trim(),
      ...(scheduledAt ? { scheduledAt } : {}),
    });
    // The handoff opens the referral form (modal or page) — always close
    // every review modal behind it.
    onClose();
  }

  return (
    <>
      <Dialog open onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
        <DialogContent
          className={styles.dialogScrollHidden}
          style={{ maxWidth: "36rem", maxHeight: "90vh", overflowY: "auto" }}
        >
          <DialogHeader>
            <DialogTitle>Review ADM case</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <dl className={styles.intakeSummary}>
            <div className={styles.intakeRow}>
              <dt className={styles.intakeLabel}>Name</dt>
              <dd className={styles.intakeValue}>{student}</dd>
            </div>
            <div className={styles.intakeRow}>
              <dt className={styles.intakeLabel}>LRN</dt>
              <dd className={styles.intakeValue}>{lrn}</dd>
            </div>
            <div className={styles.intakeRow}>
              <dt className={styles.intakeLabel}>Section</dt>
              <dd className={styles.intakeValue}>{sectionLine}</dd>
            </div>
            <div className={styles.intakeRow}>
              <dt className={styles.intakeLabel}>Observed</dt>
              <dd className={styles.intakeValue}>{observed}</dd>
            </div>
            <div className={styles.intakeRow}>
              <dt className={styles.intakeLabel}>Referred</dt>
              <dd className={styles.intakeValue}>{referred}</dd>
            </div>
          </dl>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Official report</span>
            {anecdotalId ? (
              <div>
                <button
                  type="button"
                  onClick={() => setPreviewId(anecdotalId)}
                  aria-label={`Open the official anecdotal report for ${student}`}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                >
                  <FolderCard
                    label={student}
                    sublabel={`${lrn} · ${observed}`}
                    files={[
                      {
                        name: `OCForm-01_${observed}`,
                        tag: `${category} · tap to preview`,
                        icon: "doc" as const,
                      },
                    ]}
                  />
                </button>
              </div>
            ) : (
              <p className={styles.fieldHint}>No official report attached to this case.</p>
            )}
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{sessionSectionLabel}</span>
            <div className={styles.sessionGrid}>
              <ClinicDatePicker
                id="shared-adm-session-date"
                label="Date"
                value={sessionDate}
                onChange={setSessionDate}
                min={todayKey()}
              />
              <ClinicTimePicker
                id="shared-adm-session-time"
                label="Time"
                value={sessionTime}
                onChange={setSessionTime}
              />
            </div>
            {hasActiveSession ? (
              <p className={styles.fieldHint} role="note">
                {copy.activeSessionExists}
              </p>
            ) : (
              <p className={styles.fieldHint}>{sessionFieldHint}</p>
            )}
          </div>
          <div className={styles.field}>
            <Label htmlFor="shared-adm-review-rec">Your recommendation (required)</Label>
            <Textarea
              id="shared-adm-review-rec"
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder={recommendationPlaceholder}
              maxLength={500}
            />
          </div>
          {error ? <p className={styles.dialogError} role="alert">{error}</p> : null}
          <DialogFooter>
            <Button
              variant="destructive"
              className={styles.btnRed}
              onClick={askReject}
              disabled={acting || booking}
            >
              {acting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Reject
            </Button>
            <Button variant="outline" onClick={askBook} disabled={acting || booking}>
              {booking ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Book session
            </Button>
            <Button onClick={askCreate} disabled={acting || booking}>
              Create referral
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmFor && (
        <Dialog
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) setConfirmFor(null);
          }}
        >
          <DialogContent className={styles.dialogScrollHidden}>
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
                  <>A {sessionNoun} session will be scheduled for {student}. The case stays pending until you decide.</>
                ) : confirmFor === "reject" ? (
                  <>{student}&rsquo;s case will be closed without ADM follow-through — the coordinator never receives it. This can&apos;t be undone.</>
                ) : (
                  <>Open the referral form with your recommendation carried over.{createConfirmHint ? ` ${createConfirmHint}` : ""}</>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="destructive"
                className={styles.btnRed}
                onClick={() => setConfirmFor(null)}
                disabled={acting || booking}
              >
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
                  className={styles.btnRed}
                  onClick={() => void decideReject()}
                  disabled={acting}
                >
                  {acting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  Yes, reject
                </Button>
              ) : (
                <Button onClick={goToReferralForm}>
                  Continue
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {blockedOpen && (
        <Dialog
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) setBlockedOpen(false);
          }}
        >
          <DialogContent className={styles.dialogScrollHidden}>
            <DialogHeader>
              <DialogTitle>Finish the upcoming session first</DialogTitle>
              <DialogDescription>
                {student}&rsquo;s referral still has an upcoming {sessionNoun} session
                (or follow-up) to be done. Create referral cannot be bypassed —
                finish or cancel that session first, then come back to create
                the referral.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBlockedOpen(false)}>
                Got it
              </Button>
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
