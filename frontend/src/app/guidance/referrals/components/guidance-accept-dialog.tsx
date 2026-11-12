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
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { Textarea } from "@/components/ui/textarea";
import {
  AnecdotalRecordKanbanCard,
  humanizeCategory,
} from "@/components/anecdotal/anecdotal-record-kanban-card";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { ClinicDatePicker } from "@/app/nurse/overview/components/ClinicDateTimePicker";
import { TimePickers } from "@/app/teacher/chat/components/TimePickers";
import { anecdotalCategoryBadgeVariant } from "@/lib/labels/anecdotal";
import type { CounselingSessionType } from "@/services/guidance/guidance.types";
import {
  SESSION_KIND_OPTIONS,
  combineDateTime,
  formatDate,
  formatDateTime,
  hasScheduledSession,
  sessionTypeLabel,
} from "./guidance-referrals-format";
import { FormDropdown } from "./form-dropdown";
import type { GuidanceDialogProps } from "./guidance-dialog-props";
import styles from "./GuidanceReferralDialogs.module.css";
import boardStyles from "@/components/adm-review/adm-review-dialog.module.css";

/* Amber — the official-report folder accent (same as the SF10 record cards
   and the ADM review overlay). */
const REPORT_FOLDER_COLOR = "#f59e0b";

/** Local calendar day — bookings are written as local wall-clock time. */
function todayKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/** Local current time as "HH:MM" — the floor for today's clock picker. */
function currentTimeKey(): string {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

/**
 * Counseling case review overlay — same board anatomy as the ADM review
 * overlay: a case-info board, the official report folder and the first-session
 * board, with the action buttons pinned to the footer's right edge.
 */
export function AcceptDialog({
  dialogs,
  form,
  setForm,
  activeRow,
  isActionPending,
  closeDialog,
  handleAction,
}: GuidanceDialogProps) {
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const row = activeRow;
  const student = row?.student ?? "this learner";
  const [sectionName, sectionGrade] = (row?.section || "·")
    .split("·")
    .map((part) => part.trim());
  const grade = row?.grade?.trim() || sectionGrade || "Grade level";
  const category = row?.category?.trim() || "—";
  const referred = row?.date?.trim() ? formatDate(row.date) : "—";
  /** Today's local day — the date picker refuses anything before it. */
  const today = todayKey();

  /* A case whose session is already booked opens as a read-only review: the
     board shows the booking details and nothing can be booked or rejected
     again from here (reschedule/cancel live on the case card). */
  const bookedSession =
    row && hasScheduledSession(row.sessions)
      ? row.sessions.find((s) => s.status === "scheduled") ?? null
      : null;
  const reviewOnly = bookedSession !== null;

  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);

  /** First session payload from the board (null when the date/time is incomplete). */
  function sessionPayload() {
    if (!form.sessDate || !form.sessTime) return null;
    const scheduledAt = combineDateTime(form.sessDate, form.sessTime);
    if (!scheduledAt) return null;
    return {
      scheduledAt,
      sessionType: form.sessType as CounselingSessionType,
      ...(form.sessVenue.trim() ? { venue: form.sessVenue.trim() } : {}),
    };
  }

  /* Booking does not decide the case — the session lands on the card and the
     case moves to in-progress. The shared action hook closes the overlay (the
     card is patched optimistically), so the learner's card then offers
     "Reschedule session" like an ADM case. */
  function handleBookSession() {
    // An upcoming session already holds the slot — the ADM review behaves the
    // same way; nothing gets booked twice.
    if (reviewOnly) {
      setLocalError(
        "This case already has a session that is not done yet — finish or cancel it from the case card before booking another one.",
      );
      return;
    }
    const payload = sessionPayload();
    if (!payload) {
      setLocalError("Pick both a date and a time for the session.");
      return;
    }
    // The pickers block past days/times, but the shared form can still hold a
    // date from an earlier visit — never let that reach the API.
    if (new Date(payload.scheduledAt).getTime() < Date.now()) {
      setLocalError("The session has to be in the future.");
      return;
    }
    setLocalError(null);
    handleAction("schedule", payload);
  }

  function handleReject() {
    const reason = rejectReason.trim();
    if (!reason) {
      setLocalError("Write a short reason before rejecting the case.");
      return;
    }
    setLocalError(null);
    setRejectOpen(false);
    setRejectReason("");
    handleAction("dismiss", { reason });
  }

  return (
    <>
      <KanbanOverlay
        open={dialogs.accept}
        onClose={() => closeDialog("accept")}
        dismissable={!isActionPending}
        busy={isActionPending}
        width="xl"
        title="Review counseling case"
        icon={
          <span className="text-primary" aria-hidden>
            <ClipboardCheck size={14} />
          </span>
        }
        description={
          reviewOnly ? (
            <>
              Review {student}&rsquo;s case. A counseling session is already
              booked — reschedule or cancel it from the case card.
            </>
          ) : (
            <>
              Review {student}&rsquo;s case and book the first counseling session.
              You can schedule more sessions afterwards.
            </>
          )
        }
        footer={
          <div className="flex flex-wrap items-center justify-end gap-1.5 px-1 pb-1">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className={`h-6 px-3 text-xs ${boardStyles.btnRed}`}
              onClick={() => {
                setLocalError(null);
                setRejectOpen(true);
              }}
              disabled={isActionPending}
            >
              <XCircle size={12} aria-hidden />
              Reject
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-3 text-xs"
              onClick={handleBookSession}
              disabled={isActionPending}
            >
              <CalendarPlus size={12} aria-hidden />
              Book session
            </Button>
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
              <dl className={boardStyles.intakeSummary}>
                <div className={boardStyles.intakeRow}>
                  <dt className={boardStyles.intakeLabel}>Name</dt>
                  <dd className={`${boardStyles.intakeValue} text-[14px] font-semibold`}>
                    {row?.student || "—"}
                  </dd>
                </div>
                <div className={boardStyles.intakeRow}>
                  <dt className={boardStyles.intakeLabel}>LRN</dt>
                  <dd className={boardStyles.intakeValue}>
                    <Pill label="LRN" className="tabular-nums">
                      {row?.lrn?.trim() || "—"}
                    </Pill>
                  </dd>
                </div>
                <div className={boardStyles.intakeRow}>
                  <dt className={boardStyles.intakeLabel}>Section</dt>
                  <dd className={boardStyles.intakeValue}>
                    <Pill
                      tone="amber"
                      aria-label={`Section ${sectionName}`}
                      label={grade}
                      className="min-w-0 max-w-full overflow-hidden"
                    >
                      <span className="truncate">{sectionName || "—"}</span>
                    </Pill>
                  </dd>
                </div>
                <div className={boardStyles.intakeRow}>
                  <dt className={boardStyles.intakeLabel}>Category</dt>
                  <dd className={boardStyles.intakeValue}>
                    <Pill
                      tone={anecdotalCategoryBadgeVariant(category) ?? "neutral"}
                      label="Category"
                    >
                      {humanizeCategory(category)}
                    </Pill>
                  </dd>
                </div>
                <div className={boardStyles.intakeRow}>
                  <dt className={boardStyles.intakeLabel}>Referred</dt>
                  <dd className={boardStyles.intakeValue}>{referred}</dd>
                </div>
              </dl>
            </div>
          </KanbanBoard>

          {row?.anecdotalId ? (
            <AnecdotalRecordKanbanCard
              category={category}
              headerTitle="Official report"
              studentName={row.student}
              metaText={row.lrn}
              metaTitle={`${row.lrn} · ${referred}`}
              metaLabel="LRN"
              plainName
              fileName={`OCForm-01_${row.date || "report"}`}
              fileTag={`${humanizeCategory(category)} · tap to preview`}
              folderColor={REPORT_FOLDER_COLOR}
              folderAlign="start"
              openLabel={`Open the official anecdotal report for ${student}`}
              onOpen={() => setPreviewId(row.anecdotalId)}
            />
          ) : (
            <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 [font-family:var(--font-inter)] dark:bg-muted/20">
              <span className="-mx-2.5 flex min-w-0 items-center gap-1.5 border-b border-border px-3.5 pb-2 text-[13px] font-semibold">
                <FileText size={14} className="text-muted-foreground" aria-hidden />
                <span className="truncate">Official report</span>
              </span>
              <p className={`${boardStyles.fieldHint} px-1`}>
                No official report attached to this case.
              </p>
            </div>
          )}

          {reviewOnly && bookedSession ? (
            <KanbanBoard
              className="flex-1 md:col-span-2"
              title="Counseling session"
              icon={
                <span className="text-primary" aria-hidden>
                  <CalendarClock size={14} />
                </span>
              }
              description="This session is already booked — reschedule or cancel it from the case card."
            >
              <div className="px-1">
                <dl className={boardStyles.intakeSummary}>
                  <div className={boardStyles.intakeRow}>
                    <dt className={boardStyles.intakeLabel}>Date &amp; time</dt>
                    <dd className={boardStyles.intakeValue}>
                      <Pill tone="blue" label="Booked session">
                        {formatDateTime(bookedSession.scheduledAt)}
                      </Pill>
                    </dd>
                  </div>
                  <div className={boardStyles.intakeRow}>
                    <dt className={boardStyles.intakeLabel}>Session kind</dt>
                    <dd className={boardStyles.intakeValue}>
                      {sessionTypeLabel(bookedSession.sessionType)}
                    </dd>
                  </div>
                  <div className={boardStyles.intakeRow}>
                    <dt className={boardStyles.intakeLabel}>Venue</dt>
                    <dd className={boardStyles.intakeValue}>
                      {bookedSession.venue?.trim() || "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            </KanbanBoard>
          ) : (
            <KanbanBoard
              className="flex-1 md:col-span-2"
              title="First counseling session (optional)"
              icon={
                <span className="text-primary" aria-hidden>
                  <CalendarClock size={14} />
                </span>
              }
              description="Book it now or leave it empty — you can schedule a session later."
            >
              <div className={`${boardStyles.sessionGrid} px-1`}>
                <ClinicDatePicker
                  id="counseling-first-date"
                  label="Date"
                  labelClassName="text-xs"
                  value={form.sessDate}
                  onChange={(v) => setForm((f) => ({ ...f, sessDate: v }))}
                  min={today}
                />
                <div>
                  <Label className="text-xs">Time</Label>
                  <div className="mt-1">
                    {/* Clock-face picker — floored to the current time when
                        booking for today (same control as the ADM review). */}
                    <TimePickers
                      value={form.sessTime}
                      onChange={(v) => setForm((f) => ({ ...f, sessTime: v }))}
                      minTime={
                        form.sessDate === today ? currentTimeKey() : undefined
                      }
                    />
                  </div>
                </div>
                <FormDropdown
                  id="counseling-first-type"
                  label="Session kind"
                  value={form.sessType}
                  onChange={(v) => setForm((f) => ({ ...f, sessType: v }))}
                  placeholder="Pick a kind"
                  options={SESSION_KIND_OPTIONS}
                />
                <div>
                  <Label htmlFor="counseling-first-venue">Venue (optional)</Label>
                  <Input
                    id="counseling-first-venue"
                    className="mt-1"
                    value={form.sessVenue}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sessVenue: e.target.value }))
                    }
                    placeholder="e.g. Guidance office"
                    maxLength={200}
                  />
                </div>
              </div>
            </KanbanBoard>
          )}
        </div>
        {localError ? (
          <p className={`${boardStyles.dialogError} px-1`} role="alert">
            {localError}
          </p>
        ) : null}
      </KanbanOverlay>

      <KanbanOverlay
        open={dialogs.accept && rejectOpen}
        onClose={() => {
          if (!isActionPending) setRejectOpen(false);
        }}
        dismissable={!isActionPending}
        busy={isActionPending}
        width="md"
        title={`Reject this case${row ? ` — ${row.student}` : ""}`}
        description="The case closes with your reason on record, and the filing adviser is notified."
        footer={
          <div className="flex flex-wrap items-center justify-end gap-1.5 px-1 pb-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-3 text-xs"
              onClick={() => setRejectOpen(false)}
              disabled={isActionPending}
            >
              Keep the case
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className={`h-6 px-3 text-xs ${boardStyles.btnRed}`}
              onClick={handleReject}
              disabled={isActionPending}
            >
              {isActionPending ? (
                <Loader2 className={styles.spin} aria-hidden="true" />
              ) : (
                <XCircle size={12} aria-hidden />
              )}
              {isActionPending ? "Rejecting…" : "Reject case"}
            </Button>
          </div>
        }
      >
        <div className="px-1 pb-1">
          <Label htmlFor="counseling-reject-reason">Reason (required)</Label>
          <Textarea
            id="counseling-reject-reason"
            className="mt-1"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Why is this case being rejected?"
            maxLength={500}
          />
        </div>
      </KanbanOverlay>

      {previewId ? (
        <OcForm01PreviewDialog
          recordId={previewId}
          onClose={() => setPreviewId(null)}
        />
      ) : null}
    </>
  );
}
