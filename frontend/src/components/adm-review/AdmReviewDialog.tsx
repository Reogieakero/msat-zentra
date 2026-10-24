"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import {
  CalendarClock,
  ClipboardCheck,
  FileText,
  IdCard,
  Loader2,
  NotebookPen,
  X,
} from "lucide-react";
import {
  AnecdotalRecordKanbanCard,
  humanizeCategory,
} from "@/components/anecdotal/anecdotal-record-kanban-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Pill } from "@/components/ui/pill";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Textarea } from "@/components/ui/textarea";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { ClinicDatePicker } from "@/app/nurse/overview/components/ClinicDateTimePicker";
import { TimePickers } from "@/app/teacher/chat/components/TimePickers";
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
/* Amber — the official-report folder accent (same as the SF10 record cards). */
const REPORT_FOLDER_COLOR = "#f59e0b";
export function AdmReviewDialog({
  open,
  onClose,
  student,
  lrn,
  sectionLine,
  observed,
  category,
  referred,
  waiting,
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
  /** Days-in-queue note (e.g. "waiting 3d") — pinned right of Referred. */
  waiting?: string;
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
  // Callers pass "Section · Grade" — the pill shows the section only and the
  // grade level lives in its hover tooltip.
  const [sectionName, sectionGrade] = sectionLine
    .split("·")
    .map((part) => part.trim());
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
    student,
    sessionNoun,
    hasActiveSession,
    copy,
    formatError,
    onBookSession,
    onReject,
    onCreateReferral,
    onClose,
  });
  // Kanban-style overlay: the dark backdrop and Escape close it — never
  // while a request is in flight, or while a nested overlay (confirm /
  // blocked / report preview) owns the top layer.
  const locked = acting || booking;
  const nestedOverlayOpen =
    confirmFor !== null || blockedOpen || previewId !== null;
  // Portal the overlay to <body>: the kanban card's rise-in animation leaves
  // a transform on the card, which makes the card a containing block and
  // would trap the fixed overlay inside the card's box.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  React.useEffect(() => {
    if (!open || locked || nestedOverlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, locked, nestedOverlayOpen, onClose]);

  if (!open || !mounted) return null;
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Review ADM case"
        aria-busy={locked || undefined}
      >
        <button
          type="button"
          aria-label="Cancel"
          onClick={() => {
            if (!locked) onClose();
          }}
          disabled={locked}
          className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-[2px]"
        />
        <div className="relative w-full max-w-3xl">
          <KanbanBoard
            className={`bg-card max-h-[90vh] overflow-y-auto shadow-2xl ${styles.dialogScrollHidden}`}
            title="Review ADM case"
            icon={
              <span className="text-primary" aria-hidden>
                <ClipboardCheck size={14} />
              </span>
            }
            actions={
              /* 24px close X — same as the other overlay kanbans. */
              <button
                type="button"
                onClick={onClose}
                disabled={locked}
                autoFocus
                aria-label="Close dialog"
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                <X size={14} aria-hidden="true" />
              </button>
            }
            description={description}
            boardLabel={`Review ADM case, ${student}`}
            footer={
              /* 24px action buttons — same metric as the kanban boards. */
              <div className="flex flex-wrap items-center justify-end gap-1.5 px-1 pb-1">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className={`h-6 px-3 text-xs ${styles.btnRed}`}
                  onClick={askReject}
                  disabled={locked}
                  aria-busy={acting || undefined}
                >
                  {acting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  {acting ? "Rejecting…" : "Reject"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-3 text-xs"
                  onClick={askBook}
                  disabled={locked}
                  aria-busy={booking || undefined}
                >
                  {booking ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  {booking ? "Booking…" : "Book session"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-6 px-3 text-xs"
                  onClick={askCreate}
                  disabled={locked}
                >
                  Create referral
                </Button>
              </div>
            }
          >
            {/* One kanban card per section — 2-up grid; session sits left
                of the recommendation. */}
            <div className="grid gap-3 px-1 pb-1 md:grid-cols-2">
              <KanbanBoard
                className="flex-1"
                title="Case info"
                icon={
                  <span className="text-primary" aria-hidden>
                    <IdCard size={14} />
                  </span>
                }
              >
                <div className="px-1">
                  <dl className={styles.intakeSummary}>
                    <div className={styles.intakeRow}>
                      <dt className={styles.intakeLabel}>Name</dt>
                      <dd className={`${styles.intakeValue} text-[14px] font-semibold`}>
                        {student}
                      </dd>
                    </div>
                    <div className={styles.intakeRow}>
                      <dt className={styles.intakeLabel}>LRN</dt>
                      <dd className={styles.intakeValue}>
                        <Pill label="LRN" className="tabular-nums">
                          {lrn}
                        </Pill>
                      </dd>
                    </div>
                    <div className={styles.intakeRow}>
                      <dt className={styles.intakeLabel}>Section</dt>
                      <dd className={styles.intakeValue}>
                        <Pill
                          tone="amber"
                          aria-label={`Section ${sectionName}`}
                          label={sectionGrade || "Grade level"}
                          className="min-w-0 max-w-full overflow-hidden"
                        >
                          <span className="truncate">{sectionName || "—"}</span>
                        </Pill>
                      </dd>
                    </div>
                    <div className={styles.intakeRow}>
                      <dt className={styles.intakeLabel}>Observed</dt>
                      <dd className={styles.intakeValue}>{observed}</dd>
                    </div>
                    <div className={styles.intakeRow}>
                      <dt className={styles.intakeLabel}>Referred</dt>
                      <dd className={styles.intakeValue}>{referred}</dd>
                      {waiting ? (
                        <span className="ml-auto shrink-0 self-center whitespace-nowrap text-[10px] italic text-red-600 dark:text-red-400">
                          {waiting}
                        </span>
                      ) : null}
                    </div>
                  </dl>
                </div>
              </KanbanBoard>
              {anecdotalId ? (
                <AnecdotalRecordKanbanCard
                  category={category}
                  headerTitle="Official report"
                  studentName={student}
                  metaText={lrn}
                  metaTitle={`${lrn} · ${observed}`}
                  metaLabel="LRN"
                  plainName
                  fileName={`OCForm-01_${observed}`}
                  fileTag={`${humanizeCategory(category)} · tap to preview`}
                  folderColor={REPORT_FOLDER_COLOR}
                  folderAlign="start"
                  openLabel={`Open the official anecdotal report for ${student}`}
                  onOpen={() => setPreviewId(anecdotalId)}
                />
              ) : (
                <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 [font-family:var(--font-inter)] dark:bg-muted/20">
                  <span className="-mx-2.5 flex min-w-0 items-center gap-1.5 border-b border-border px-3.5 pb-2 text-[13px] font-semibold">
                    <FileText size={14} className="text-muted-foreground" aria-hidden />
                    <span className="truncate">Official report</span>
                  </span>
                  <p className={`${styles.fieldHint} px-1`}>
                    No official report attached to this case.
                  </p>
                </div>
              )}
              <KanbanBoard
                className="flex-1"
                title={sessionSectionLabel}
                icon={
                  <span className="text-primary" aria-hidden>
                    <CalendarClock size={14} />
                  </span>
                }
                description={hasActiveSession ? copy.activeSessionExists : sessionFieldHint}
              >
                <div className={`${styles.sessionGrid} px-1`}>
                  <ClinicDatePicker
                    id="shared-adm-session-date"
                    label="Date"
                    labelClassName="text-xs"
                    value={sessionDate}
                    onChange={setSessionDate}
                    min={todayKey()}
                  />
                  <div>
                    <Label className="text-xs">Time</Label>
                    <div className="mt-1">
                      {/* Clock-face picker — same control as the chat's
                          anecdotal flow ("when it happened"). */}
                      <TimePickers value={sessionTime} onChange={setSessionTime} />
                    </div>
                  </div>
                </div>
              </KanbanBoard>
              <KanbanBoard
                className="flex-1"
                title="Your recommendation (required)"
                icon={
                  <span className="text-primary" aria-hidden>
                    <NotebookPen size={14} />
                  </span>
                }
              >
                <div className="px-1">
                  <Textarea
                    id="shared-adm-review-rec"
                    aria-label="Your recommendation (required)"
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                    placeholder={recommendationPlaceholder}
                    maxLength={500}
                  />
                </div>
              </KanbanBoard>
            </div>
            {error ? <p className={`${styles.dialogError} px-1`} role="alert">{error}</p> : null}
          </KanbanBoard>
        </div>
      </div>
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
    </>,
    document.body,
  );
}
