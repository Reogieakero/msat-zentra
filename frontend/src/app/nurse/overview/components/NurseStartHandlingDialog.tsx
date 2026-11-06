"use client";

import * as React from "react";
import {
  CalendarClock,
  FileText,
  IdCard,
  Loader2,
  NotebookPen,
  Stethoscope,
  X,
} from "lucide-react";
import {
  AnecdotalRecordKanbanCard,
  humanizeCategory,
} from "@/components/anecdotal/anecdotal-record-kanban-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Textarea } from "@/components/ui/textarea";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { useDock } from "@/components/dock/dock-store";
import { ClinicDatePicker } from "./ClinicDateTimePicker";
import { TimePickers } from "@/app/teacher/chat/components/TimePickers";
import { apiErrorMessage } from "@/lib/api/errors";
import { acceptNurseCase } from "@/services/nurse/referrals.service";
import type { NurseQueueRow } from "@/services/nurse/nurse.types";
import { useNurseMutation } from "./use-nurse-mutation";
import styles from "@/components/adm-review/adm-review-dialog.module.css";

/* Amber — the official-report folder accent (same as the ADM review overlay). */
const REPORT_FOLDER_COLOR = "#f59e0b";
/* Pill rectangles — same metrics as the ADM review overlay's case info. */
const PILL_NAME =
  "inline-flex max-w-full items-center truncate rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold leading-tight text-amber-700 dark:text-amber-400";
const PILL_META =
  "inline-flex max-w-full items-center truncate rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium leading-tight text-secondary-foreground";

/**
 * Clinic case review overlay — same KanbanBoard design as the ADM review
 * overlay (shared shell + case info / official report / session / note
 * boards, 24px footer buttons). Accepting starts the case; the first clinic
 * session is optional.
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
  const [startNote, setStartNote] = React.useState("");
  const [sessionDate, setSessionDate] = React.useState("");
  const [sessionTime, setSessionTime] = React.useState("");
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const acceptMutation = useNurseMutation({
    mutationFn: (input: { intakeNotes?: string; scheduledAt?: string }) =>
      acceptNurseCase(row.id, input),
    successTitle: "Case accepted",
    successDescription: () => {
      const hasSession = Boolean(sessionDate && sessionTime);
      return hasSession
        ? `${row.student} is now in progress with a clinic session booked.`
        : `${row.student} is now in progress.`;
    },
    errorFallback: "Could not accept this case. Try again.",
    dock: false,
    sourceId: row.id,
    onSuccessExtra: () => {
      onClose();
      setStartNote("");
      setSessionDate("");
      setSessionTime("");
      setDialogError(null);
      onChanged();
    },
  });
  const acting = acceptMutation.isPending;
  const serverError = acceptMutation.error
    ? apiErrorMessage(acceptMutation.error, "Could not accept this case. Try again.")
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
  }

  function handleStart() {
    setDialogError(null);
    acceptMutation.reset();
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
    const payload = {
      ...(startNote.trim() ? { intakeNotes: startNote.trim() } : {}),
      ...(scheduledAt ? { scheduledAt } : {}),
    };
    // The shared Dock in the bottom-right reports the request until it
    // settles — same as the ADM review flow — so the nurse can move on the
    // moment the dialog closes.
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "generic",
        title: "Accepting clinic case",
        description: scheduledAt
          ? `${row.student} · ${sessionDate} ${sessionTime}`
          : `${row.student} · clinic desk`,
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

  // Kanban-style overlay: the dark backdrop and Escape close it — never
  // while the accept request is in flight, or while the report preview owns
  // the top layer.
  const locked = acting;
  const nestedOverlayOpen = previewOpen;
  React.useEffect(() => {
    if (!open || locked || nestedOverlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        setDialogError(null);
        acceptMutation.reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, locked, nestedOverlayOpen, onClose, acceptMutation]);

  if (!open) return null;

  return (
    <>
      {/* `whitespace-normal` — the row cell that mounts this overlay sets
          `white-space: nowrap` (nurse-overview.module.css `.cellActions`),
          and white-space inherits, so without the reset every sentence in
          the dialog ran past its board instead of wrapping. */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 whitespace-normal"
        role="dialog"
        aria-modal="true"
        aria-label="Review clinic case"
        aria-busy={locked || undefined}
      >
        <button
          type="button"
          aria-label="Cancel"
          onClick={closeDialog}
          disabled={locked}
          className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-[2px]"
        />
        <div className="relative w-full max-w-3xl">
          <KanbanBoard
            className={`bg-card max-h-[90vh] overflow-y-auto shadow-2xl ${styles.dialogScrollHidden}`}
            title="Review clinic case"
            icon={
              <span className="text-primary" aria-hidden>
                <Stethoscope size={14} />
              </span>
            }
            actions={
              /* 24px close X — same as the other overlay kanbans. */
              <button
                type="button"
                onClick={closeDialog}
                disabled={locked}
                autoFocus
                aria-label="Close dialog"
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                <X size={14} aria-hidden="true" />
              </button>
            }
            description="Step 1 — review the referral and its anecdotal report, record your opening note, book the first clinic session, then accept it."
            boardLabel={`Review clinic case, ${row.student}`}
            footer={
              /* 24px action button — same metric as the kanban boards. */
              <div className="flex flex-wrap items-center justify-end gap-1.5 px-1 pb-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-6 px-3 text-xs"
                  onClick={() => void handleStart()}
                  disabled={locked}
                  aria-busy={acting || undefined}
                >
                  {acting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  {acting ? "Accepting…" : "Accept & start handling"}
                </Button>
              </div>
            }
          >
            {/* One kanban card per section — 2-up grid; session sits left
                of the opening note, same as the ADM review overlay. */}
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
                      <dd className={styles.intakeValue}>
                        <span className={PILL_NAME} title={row.student}>
                          {row.student}
                        </span>
                      </dd>
                    </div>
                    <div className={styles.intakeRow}>
                      <dt className={styles.intakeLabel}>LRN</dt>
                      <dd className={styles.intakeValue}>
                        <span className={PILL_META} title={row.lrn}>
                          {row.lrn}
                        </span>
                      </dd>
                    </div>
                    <div className={styles.intakeRow}>
                      <dt className={styles.intakeLabel}>Section</dt>
                      <dd className={styles.intakeValue}>
                        <span
                          className={PILL_META}
                          title={`${row.section} · ${row.grade}`}
                        >
                          {row.section} · {row.grade}
                        </span>
                      </dd>
                    </div>
                    <div className={styles.intakeRow}>
                      <dt className={styles.intakeLabel}>Observed</dt>
                      <dd className={styles.intakeValue}>{observed}</dd>
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
                className="flex-1"
                title="Clinic session (optional)"
                icon={
                  <span className="text-primary" aria-hidden>
                    <CalendarClock size={14} />
                  </span>
                }
                description="Held at the school clinic. Leave both empty to accept without booking."
              >
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
              </KanbanBoard>
              <KanbanBoard
                className="flex-1"
                title="Opening note (optional)"
                icon={
                  <span className="text-primary" aria-hidden>
                    <NotebookPen size={14} />
                  </span>
                }
              >
                <div className="px-1">
                  <Textarea
                    id={`start-${row.id}`}
                    aria-label="Opening note (optional)"
                    value={startNote}
                    onChange={(e) => setStartNote(e.target.value)}
                    placeholder="First impressions, initial findings, next steps…"
                  />
                </div>
              </KanbanBoard>
            </div>
            {dialogError || serverError ? (
              <p className={`${styles.dialogError} px-1`} role="alert">
                {dialogError ?? serverError}
              </p>
            ) : null}
          </KanbanBoard>
        </div>
      </div>
      {row.anecdotalId && previewOpen ? (
        <OcForm01PreviewDialog
          recordId={row.anecdotalId}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
