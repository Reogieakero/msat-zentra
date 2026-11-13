"use client";

import * as React from "react";
import {
  CalendarClock,
  CalendarPlus,
  ClipboardCheck,
  FileText,
  IdCard,
  Loader2,
  XCircle,
} from "lucide-react";
import {
  AnecdotalRecordKanbanCard,
  humanizeCategory,
} from "@/components/anecdotal/anecdotal-record-kanban-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Pill } from "@/components/ui/pill";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Textarea } from "@/components/ui/textarea";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { useDock } from "@/components/dock/dock-store";
import { anecdotalCategoryBadgeVariant } from "@/lib/labels/anecdotal";
import { sessionTypeLabel } from "@/lib/labels/sessions";
import { formatDate, formatTime } from "../../referrals/components/nurse-referrals-format";
import { ClinicDatePicker } from "./ClinicDateTimePicker";
import { TimePickers } from "@/app/teacher/chat/components/TimePickers";
import { apiErrorMessage } from "@/lib/api/errors";
import {
  acceptNurseCase,
  updateNurseReferralStatus,
} from "@/services/nurse/referrals.service";
import type { NurseQueueRow } from "@/services/nurse/nurse.types";
import { useNurseMutation } from "./use-nurse-mutation";
import styles from "@/components/adm-review/adm-review-dialog.module.css";

/* Amber — the official-report folder accent (same as the ADM review overlay). */
const REPORT_FOLDER_COLOR = "#f59e0b";

/**
 * Clinic case review overlay — same board anatomy and chrome as the guidance
 * "Review counseling case" overlay: KanbanOverlay shell, case-info board, the
 * official report folder, the first-session board and the opening note, with
 * the actions pinned to the footer's right edge. Accepting starts the case;
 * the first clinic session is optional.
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
  const dock = useDock();
  const [sessionDate, setSessionDate] = React.useState("");
  const [sessionTime, setSessionTime] = React.useState("");
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  /* Recommendation for a rejection — mirrors the ADM review's required
     recommendation, and is stored as the closed case's reason. */
  const [recommendation, setRecommendation] = React.useState("");

  /* A case whose session is already booked opens as a review: the board shows
     the booking details, no further session can be booked from here (reschedule
     / cancel live on the case card), but the case can still be rejected. */
  const isPending = row.status === "pending" || row.status === "escalated";
  const isClosed = row.status === "resolved" || row.status === "dismissed";
  const bookedSession =
    row.sessions.find((s) => s.status === "scheduled") ?? null;
  const reviewOnly = !isPending || bookedSession !== null;

  const acceptMutation = useNurseMutation({
    mutationFn: (input: {
      intakeNotes?: string;
      scheduledAt?: string;
    }) => acceptNurseCase(row.id, input),
    successTitle: "Case accepted",
    successDescription: () =>
      `${row.student} is now in progress with a clinic session booked.`,
    errorFallback: "Could not accept this case. Try again.",
    dock: false,
    sourceId: row.id,
    onSuccessExtra: () => {
      onClose();
      setSessionDate("");
      setSessionTime("");
      setDialogError(null);
      onChanged();
    },
  });
  /* Rejecting a clinic case closes it with the nurse's recommendation on
     record — the adviser desk hears the clinic-reject clip. Mirrors the ADM
     review's reject flow (required recommendation, then confirm). */
  const rejectMutation = useNurseMutation({
    mutationFn: (recommendationText: string) =>
      updateNurseReferralStatus(row.id, "dismissed", recommendationText),
    successTitle: "Case rejected",
    successDescription: () => `${row.student}'s case was closed.`,
    errorFallback: "Could not reject this case. Try again.",
    dock: false,
    sourceId: row.id,
    onSuccessExtra: () => {
      onClose();
      setRejectOpen(false);
      setRecommendation("");
      setDialogError(null);
      onChanged();
    },
  });
  const acting = acceptMutation.isPending || rejectMutation.isPending;
  const serverError = acceptMutation.error
    ? apiErrorMessage(acceptMutation.error, "Could not accept this case. Try again.")
    : rejectMutation.error
      ? apiErrorMessage(rejectMutation.error, "Could not reject this case. Try again.")
      : null;

  const observed = row.anecdotal?.observedAt ?? "—";
  const category = row.anecdotal?.category ?? row.category;
  const waiting =
    row.waitingDays !== null && row.waitingDays > 0
      ? `waiting ${row.waitingDays}d`
      : undefined;

  function todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function closeDialog() {
    onClose();
    setDialogError(null);
    acceptMutation.reset();
    rejectMutation.reset();
  }

  function handleStart() {
    setDialogError(null);
    acceptMutation.reset();
    if (!sessionDate || !sessionTime) {
      setDialogError("Pick both a date and a time for the clinic session.");
      return;
    }
    const at = new Date(`${sessionDate}T${sessionTime}:00`);
    if (Number.isNaN(at.getTime())) {
      setDialogError("Pick a valid date and time for the clinic session.");
      return;
    }
    if (at.getTime() <= Date.now()) {
      setDialogError("The session has to be in the future.");
      return;
    }
    const scheduledAt = `${sessionDate}T${sessionTime}:00`;
    const payload = {
      scheduledAt,
    };
    // The shared Dock in the bottom-right reports the request until it
    // settles — same as the ADM review flow — so the nurse can move on the
    // moment the dialog closes.
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "generic",
        title: "Booking clinic session",
        description: `${row.student} · ${sessionDate} ${sessionTime}`,
      });
    } catch {
      taskId = null;
    }
    acceptMutation.mutate(payload, {
      onSuccess: () => {
        if (taskId) dock.completeTask(taskId);
      },
      onError: (err) => {
        if (taskId) {
          dock.failTask(
            taskId,
            apiErrorMessage(err, "Could not accept this case. Try again."),
          );
        }
      },
    });
    // Close at once — the Dock carries the request until it settles.
    onClose();
  }

  /* Reject is two-step, like the ADM review: the recommendation is written
     and validated on the review board, then confirmed on a second overlay. */
  function askReject() {
    setDialogError(null);
    rejectMutation.reset();
    if (!recommendation.trim()) {
      setDialogError("Write a short recommendation before rejecting the case.");
      return;
    }
    setRejectOpen(true);
  }

  function confirmReject() {
    const text = recommendation.trim();
    if (!text) {
      setDialogError("Write a short recommendation before rejecting the case.");
      setRejectOpen(false);
      return;
    }
    setDialogError(null);
    rejectMutation.mutate(text);
  }

  return (
    <>
      <KanbanOverlay
        open={open}
        onClose={closeDialog}
        dismissable={!acting}
        busy={acting}
        width="xl"
        title="Review clinic case"
        icon={
          <span className="text-primary" aria-hidden>
            <ClipboardCheck size={14} />
          </span>
        }
        description={
          reviewOnly
            ? `Review ${row.student}'s case. A clinic session is already booked — reschedule or cancel it from the case card.`
            : `Review ${row.student}'s case and book the first clinic session. Booking accepts the referral; you can schedule more sessions afterwards.`
        }
        footer={
          <div className="flex flex-wrap items-center justify-end gap-1.5 px-1 pb-1">
            {!isClosed ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className={`h-6 px-3 text-xs ${styles.btnRed}`}
                onClick={askReject}
                disabled={acting}
              >
                <XCircle size={12} aria-hidden />
                Reject
              </Button>
            ) : null}
            {isPending && !reviewOnly ? (
              <Button
                type="button"
                size="sm"
                className="h-6 px-3 text-xs"
                onClick={() => void handleStart()}
                disabled={acting}
                aria-busy={acceptMutation.isPending || undefined}
              >
                {acceptMutation.isPending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <CalendarPlus size={12} aria-hidden />
                )}
                {acceptMutation.isPending ? "Booking…" : "Book session"}
              </Button>
            ) : null}
          </div>
        }
      >
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
                    {row.student || "—"}
                  </dd>
                </div>
                <div className={styles.intakeRow}>
                  <dt className={styles.intakeLabel}>LRN</dt>
                  <dd className={styles.intakeValue}>
                    <Pill label="LRN" className="tabular-nums">
                      {row.lrn?.trim() || "—"}
                    </Pill>
                  </dd>
                </div>
                <div className={styles.intakeRow}>
                  <dt className={styles.intakeLabel}>Section</dt>
                  <dd className={styles.intakeValue}>
                    <Pill
                      tone="amber"
                      aria-label={`Section ${row.section}`}
                      label={row.grade?.trim() || "Grade level"}
                      className="min-w-0 max-w-full overflow-hidden"
                    >
                      <span className="truncate">{row.section || "—"}</span>
                    </Pill>
                  </dd>
                </div>
                <div className={styles.intakeRow}>
                  <dt className={styles.intakeLabel}>Category</dt>
                  <dd className={styles.intakeValue}>
                    <Pill
                      tone={anecdotalCategoryBadgeVariant(category) ?? "neutral"}
                      label="Category"
                    >
                      {humanizeCategory(category)}
                    </Pill>
                  </dd>
                </div>
                <div className={styles.intakeRow}>
                  <dt className={styles.intakeLabel}>Referred</dt>
                  <dd className={styles.intakeValue}>{row.date}</dd>
                  {waiting ? (
                    <span className="ml-auto shrink-0 self-center whitespace-nowrap text-[10px] italic text-red-600 dark:text-red-400">
                      {waiting}
                    </span>
                  ) : null}
                </div>
              </dl>
            </div>
          </KanbanBoard>

          {row.anecdotalId ? (
            <AnecdotalRecordKanbanCard
              category={category}
              headerTitle="Official report"
              studentName={row.student}
              metaText={row.lrn}
              metaTitle={`${row.lrn} · ${observed}`}
              metaLabel="LRN"
              plainName
              fileName={`OCForm-01_${observed}`}
              fileTag={`${humanizeCategory(category)} · tap to preview`}
              folderColor={REPORT_FOLDER_COLOR}
              folderAlign="start"
              openLabel={`Open the official anecdotal report for ${row.student}`}
              onOpen={() => setPreviewOpen(true)}
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
            className={`flex-1 ${reviewOnly && !isClosed ? "" : "md:col-span-2"}`}
            title={reviewOnly ? "Clinic session" : "First clinic session (optional)"}
            icon={
              <span className="text-primary" aria-hidden>
                <CalendarClock size={14} />
              </span>
            }
            description={
              reviewOnly
                ? "This session is already booked — reschedule or cancel it from the case card."
                : "Held at the school clinic — booking this session accepts the referral."
            }
          >
            {reviewOnly && bookedSession ? (
              <div className="px-1">
                <dl className={styles.intakeSummary}>
                  <div className={styles.intakeRow}>
                    <dt className={styles.intakeLabel}>Date &amp; time</dt>
                    <dd className={styles.intakeValue}>
                      <Pill tone="blue" label="Booked session">
                        {formatDate(bookedSession.date)}{" "}
                        {formatTime(bookedSession.scheduledAt)}
                      </Pill>
                    </dd>
                  </div>
                  <div className={styles.intakeRow}>
                    <dt className={styles.intakeLabel}>Session kind</dt>
                    <dd className={styles.intakeValue}>
                      {sessionTypeLabel(bookedSession.sessionType ?? "individual")}
                    </dd>
                  </div>
                  <div className={styles.intakeRow}>
                    <dt className={styles.intakeLabel}>Venue</dt>
                    <dd className={styles.intakeValue}>
                      {bookedSession.venue?.trim() || "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : !isPending ? (
              <p className={`${styles.fieldHint} px-1`}>
                No clinic session booked yet — book one from the case card.
              </p>
            ) : (
              <div className={`${styles.sessionGrid} px-1`}>
                <ClinicDatePicker
                  id={`start-session-date-${row.id}`}
                  label="Date"
                  labelClassName="text-xs"
                  value={sessionDate}
                  onChange={setSessionDate}
                  min={todayKey()}
                />
                <div>
                  <Label className="text-xs">Time</Label>
                  <div className="mt-1">
                    {/* Clock-face picker — same control as the ADM review
                        overlay's session board. */}
                    <TimePickers value={sessionTime} onChange={setSessionTime} />
                  </div>
                </div>
              </div>
            )}
          </KanbanBoard>

          {!isClosed ? (
            <KanbanBoard
              className={`flex-1 ${reviewOnly ? "" : "md:col-span-2"}`}
              title="Your recommendation (required)"
              icon={
                <span className="text-primary" aria-hidden>
                  <XCircle size={14} />
                </span>
              }
              description="Recorded with the rejection and shared with the filing adviser."
            >
              <div className="px-1">
                <Textarea
                  id={`reject-recommendation-${row.id}`}
                  aria-label="Your recommendation (required)"
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  placeholder="Why is this clinic session being rejected, and what should the adviser do next?"
                  maxLength={500}
                  disabled={acting}
                />
              </div>
            </KanbanBoard>
          ) : null}
        </div>
        {dialogError || serverError ? (
          <p className={`${styles.dialogError} px-1`} role="alert">
            {dialogError ?? serverError}
          </p>
        ) : null}
      </KanbanOverlay>

      <KanbanOverlay
        open={open && rejectOpen}
        onClose={() => {
          if (!rejectMutation.isPending) setRejectOpen(false);
        }}
        dismissable={!rejectMutation.isPending}
        busy={rejectMutation.isPending}
        width="md"
        title="Reject this case?"
        icon={
          <span className="text-red-500" aria-hidden>
            <XCircle size={14} />
          </span>
        }
        description={
          `${row.student}'s clinic case will be closed — the clinic won't handle it further, and the filing adviser is notified. This can't be undone.`
        }
        footer={
          <div className="flex flex-wrap items-center justify-end gap-1.5 px-1 pb-1">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className={`h-6 px-3 text-xs ${styles.btnRed}`}
              onClick={() => void confirmReject()}
              disabled={rejectMutation.isPending}
              aria-busy={rejectMutation.isPending || undefined}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              {rejectMutation.isPending ? "Rejecting…" : "Yes, reject"}
            </Button>
          </div>
        }
      >
        {rejectMutation.error ? (
          <p className={`${styles.dialogError} px-1`} role="alert">
            {apiErrorMessage(rejectMutation.error, "Could not reject this case. Try again.")}
          </p>
        ) : null}
      </KanbanOverlay>

      {row.anecdotalId && previewOpen ? (
        <OcForm01PreviewDialog
          recordId={row.anecdotalId}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
