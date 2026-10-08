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
import { useAdmReviewDraft } from "./use-adm-review-draft";
import { AdmReviewBlockedDialog, AdmReviewConfirmDialogs } from "./adm-review-confirm-dialogs";
import styles from "./adm-review-dialog.module.css";
export interface AdmReviewDraft {
  recommendation: string;
  scheduledAt?: string;
}
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
  const {
    recommendation,
    setRecommendation,
    sessionDate,
    setSessionDate,
    sessionTime,
    setSessionTime,
    acting,
    booking,
    confirmFor,
    setConfirmFor,
    blockedOpen,
    setBlockedOpen,
    error,
    previewId,
    setPreviewId,
    askBook,
    askReject,
    askCreate,
    bookSessionOnly,
    decideReject,
    goToReferralForm,
  } = useAdmReviewDraft({
    open,
    hasActiveSession,
    copy,
    formatError,
    onBookSession,
    onReject,
    onCreateReferral,
    onClose,
  });
  if (!open) return null;
  return (
    <>
      <Dialog open onOpenChange={(isOpen) => { if (!isOpen && !acting && !booking) onClose(); }}>
        <DialogContent
          className={styles.dialogScrollHidden}
          style={{ maxWidth: "36rem", maxHeight: "90vh", overflowY: "auto" }}
          aria-busy={acting || booking || undefined}
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
              aria-busy={acting || undefined}
            >
              {acting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {acting ? "Rejecting…" : "Reject"}
            </Button>
            <Button
              variant="outline"
              onClick={askBook}
              disabled={acting || booking}
              aria-busy={booking || undefined}
            >
              {booking ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {booking ? "Booking…" : "Book session"}
            </Button>
            <Button onClick={askCreate} disabled={acting || booking}>
              Create referral
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AdmReviewConfirmDialogs
        confirmFor={confirmFor}
        student={student}
        sessionNoun={sessionNoun}
        createConfirmHint={createConfirmHint}
        acting={acting}
        booking={booking}
        onCancel={() => setConfirmFor(null)}
        onBook={() => void bookSessionOnly()}
        onReject={() => void decideReject()}
        onCreate={() => goToReferralForm()}
      />
      <AdmReviewBlockedDialog
        open={blockedOpen}
        student={student}
        sessionNoun={sessionNoun}
        onClose={() => setBlockedOpen(false)}
      />
      {previewId && (
        <OcForm01PreviewDialog recordId={previewId} onClose={() => setPreviewId(null)} />
      )}
    </>
  );
}
