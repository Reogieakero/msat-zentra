"use client";

import * as React from "react";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookSessionDialog } from "@/components/session-booking/BookSessionDialog";
import { FinishSessionDialog as SharedFinishSessionDialog } from "@/components/session-booking/FinishSessionDialog";
import { RescheduleSessionDialog as SharedRescheduleSessionDialog } from "@/components/session-booking/RescheduleSessionDialog";
import { CancelSessionDialog as SharedCancelSessionDialog } from "@/components/session-booking/CancelSessionDialog";
import { DeleteSessionDialog as SharedDeleteSessionDialog } from "@/components/session-booking/DeleteSessionDialog";
import { apiErrorMessage } from "@/lib/api/errors";
import { toast } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
import { markSelfNotified } from "@/lib/realtime/nurseChannel";
import { formatDate, formatTime } from "@/lib/labels/datetime";
import { useQueryClient } from "@tanstack/react-query";
import {
  cancelClinicSession,
  clinicAttachmentError,
  completeClinicSession,
  deleteClinicSession,
  rescheduleClinicSession,
  scheduleClinicSession,
  uploadClinicAttachments,
} from "@/services/nurse/sessions.service";
import type {
  NurseQueueRow,
  NurseSessionItem,
} from "@/services/nurse/nurse.types";
import { invalidateNurseQueries, useNurseMutation } from "../../overview/components/use-nurse-mutation";
import { refreshBookingReminders } from "@/components/notifications/BookingReminderStack";

import { useActiveNowTick } from "@/lib/clock";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function ScheduleSessionDialog({
  row,
  open,
  onClose,
  onChanged,
}: DialogProps & { row: NurseQueueRow }) {
  const bookMutation = useNurseMutation({
    mutationFn: (fields: { scheduledAt: string; venue: string }) =>
      scheduleClinicSession(row.id, {
        scheduledAt: fields.scheduledAt,
        ...(fields.venue ? { venue: fields.venue } : {}),
      }),
    successTitle: "Session booked",
    successDescription: () => `Clinic session booked for ${row.student}.`,
    errorFallback: "Could not book the session. Try again.",
    silentError: true,
    sourceId: row.id,
    onSuccessExtra: () => {
      onClose();
      onChanged();

      refreshBookingReminders();
    },
  });
  const acting = bookMutation.isPending;
  const serverError = bookMutation.error
    ? apiErrorMessage(bookMutation.error, "Could not book the session. Try again.")
    : null;

  if (!open) return null;

  return (
    <BookSessionDialog
      open
      onClose={() => {
        onClose();
        bookMutation.reset();
      }}
      onSubmit={(fields) => {
        // Close at once — the shared Dock reports the booking until it settles.
        onClose();
        bookMutation.mutate(fields);
      }}
      description="Schedule a clinic session"
      studentCard={{
        name: row.student,
        sub: [row.grade, row.section].filter(Boolean).join(" · "),
      }}
      venueHint="Held at the school clinic unless another venue is given."
      venuePlaceholder="School clinic"
      hasActiveSession={row.sessions.some((s) => s.status === "scheduled")}
      busy={acting}
      serverError={serverError}
      idPrefix="nurse-book"
    />
  );
}

export function FinishSessionDialog({
  referralId,
  session,
  open,
  onClose,
  onConfirmed,
  onChanged,
}: DialogProps & {
  referralId: string;
  session: NurseSessionItem;
  /** Fired the moment the finish is confirmed — the page closes the Clinic
      sessions board too and the Dock reports the outcome. */
  onConfirmed: () => void;
}) {
  const dock = useDock();
  const [files, setFiles] = React.useState<File[]>([]);
  const [pickError, setPickError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  /** Dock task for the in-flight finish — completed/failed from the mutation
      callbacks, which keep firing after this overlay has unmounted. */
  const dockTaskId = React.useRef<string | null>(null);

  const finishMutation = useNurseMutation({
    mutationFn: async (fields: {
      sessionNotes: string;
      outcome?: string;
      followUpSession?: { scheduledAt: string };
    }) => {
      await completeClinicSession(referralId, session.id, {
        sessionNotes: fields.sessionNotes,
        ...(fields.outcome ? { outcome: fields.outcome } : {}),
        ...(fields.followUpSession ? { followUpAt: fields.followUpSession.scheduledAt } : {}),
      });
      if (files.length > 0) {
        await uploadClinicAttachments(referralId, session.id, files);
      }
      return { photoCount: files.length };
    },
    successTitle: "Session done",
    successDescription: (_vars, data) =>
      data.photoCount > 0
        ? `Notes saved with ${data.photoCount} photo${data.photoCount === 1 ? "" : "s"} filed.`
        : "The session was marked done.",
    errorFallback: "Could not finish the session. Try again.",
    silentError: true,
    dock: false,
    sourceId: referralId,
    scopes: ["alerts"],
    // Instant feel: mark the session completed in cached alert pages at
    // submit time; snapshots roll back automatically on error.
    optimisticUpdate: (old, fields) => {
      if (!old || typeof old !== "object" || !Array.isArray((old as { alerts?: unknown }).alerts)) {
        return old;
      }
      const page = old as { alerts: { key: string; row?: { sessions?: { id: string }[] } }[] };
      const notes = (fields as { sessionNotes: string }).sessionNotes;
      return {
        ...page,
        alerts: page.alerts.map((alert) => {
          if (!alert.row || !Array.isArray(alert.row.sessions)) return alert;
          return {
            ...alert,
            row: {
              ...alert.row,
              sessions: alert.row.sessions.map((s) =>
                s.id === session.id
                  ? { ...s, status: "completed", sessionNotes: notes, completedAt: new Date().toISOString() }
                  : s,
              ),
            },
          };
        }),
      };
    },
    onSuccessExtra: () => {
      setFiles([]);
      setPickError(null);
      onChanged();
      if (dockTaskId.current) {
        dock.completeTask(dockTaskId.current);
        dockTaskId.current = null;
      }
    },
    onErrorExtra: (err) => {
      if (dockTaskId.current) {
        dock.failTask(
          dockTaskId.current,
          apiErrorMessage(err, "Could not finish the session. Try again."),
        );
        dockTaskId.current = null;
      }
    },
  });
  const acting = finishMutation.isPending;
  const serverError = finishMutation.error
    ? apiErrorMessage(finishMutation.error, "Could not finish the session. Try again.")
    : null;
  const now = useActiveNowTick(open);

  if (!open) return null;

  const notStarted = new Date(session.scheduledAt).getTime() > now;

  function onPickFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list).slice(0, 5);
    const problem = clinicAttachmentError(picked);
    if (problem) {
      setPickError(problem);
      return;
    }
    setPickError(null);
    setFiles(picked);
  }

  function save(fields: {
    sessionNotes: string;
    outcome?: string;
    followUpSession?: { scheduledAt: string };
  }) {
    if (files.length > 0) {
      const problem = clinicAttachmentError(files);
      if (problem) {
        setPickError(problem);
        return;
      }
    }
    // The Dock carries the request: both overlays close at once (low latency),
    // the list is patched optimistically, and the Dock reports the outcome.
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "generic",
        title: "Finishing clinic session",
        description: `${session.date}${files.length > 0 ? ` · ${files.length} photo${files.length === 1 ? "" : "s"}` : ""}`,
        ...(files.length > 0 ? { total: files.length } : {}),
      });
    } catch {
      taskId = null;
    }
    dockTaskId.current = taskId;
    onClose();
    onConfirmed();
    finishMutation.mutate(fields);
  }

  function handleClose() {
    onClose();
    setPickError(null);
    finishMutation.reset();
  }

  return (
    <SharedFinishSessionDialog
      open
      onClose={handleClose}
      onSubmit={(fields) => void save(fields)}
      description="Record what happened. Photos are optional — file them now or later from the session list."
      showSessionType={false}
      showFollowUpVenue={false}
      docsSection={
        <div className="flex flex-col gap-1.5 px-1 pb-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 w-fit px-3 text-xs"
            disabled={acting}
            onClick={() => inputRef.current?.click()}
            aria-label="Choose documentation photos"
          >
            <Paperclip aria-hidden />
            Choose files
          </Button>
          <input
            ref={inputRef}
            id="nurse-done-files"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={acting}
            onChange={(e) => {
              onPickFiles(e.target.files);
              e.target.value = "";
            }}
            className="sr-only"
          />
          <p className="text-[11px] text-muted-foreground">
            {files.length === 0
              ? "Wound photo, referral slip, lab result… JPG/PNG/WEBP, max 5 at a time, 5 MB each. You can skip this."
              : `${files.length} photo${files.length === 1 ? "" : "s"} selected: ${files.map((f) => f.name).join(", ")}`}
          </p>
        </div>
      }
      notStarted={notStarted}
      busy={acting}
      serverError={pickError ?? serverError}
      idPrefix="nurse-done"
    />
  );
}

export function MoveSessionDialog({
  referralId,
  session,
  student,
  open,
  onClose,
  onConfirmed,
  onChanged,
}: DialogProps & {
  referralId: string;
  session: NurseSessionItem;
  student: string;
  /** Fired the moment the move is confirmed — the page closes the sessions
      board too and the Dock reports the outcome. */
  onConfirmed: () => void;
}) {
  const dock = useDock();
  const queryClient = useQueryClient();

  if (!open) return null;

  // Confirming hands the request to the bottom-right Dock: the overlay and the
  // sessions board close at once, so a slow request never leaves them stuck on
  // "Moving…". The wrapper unmounts on confirm, so the success side-effects
  // (toast, list refresh) run here in the closure instead of a mutation hook.
  async function confirmMove(scheduledAt: string) {
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "generic",
        title: "Moving clinic session",
        description: `${student} · ${formatDate(scheduledAt.slice(0, 10))} · ${formatTime(scheduledAt)}`,
      });
    } catch {
      taskId = null;
    }
    onClose();
    onConfirmed();
    try {
      await rescheduleClinicSession(referralId, session.id, scheduledAt);
      markSelfNotified(referralId);
      invalidateNurseQueries(queryClient);
      toast.success({ title: "Session moved", description: "The session was moved." });
      onChanged();
      if (taskId) dock.completeTask(taskId);
    } catch (err) {
      if (taskId) {
        dock.failTask(
          taskId,
          apiErrorMessage(err, "Could not move the session. Try again."),
        );
      }
    }
  }

  return (
    <SharedRescheduleSessionDialog
      open
      onClose={onClose}
      onSubmit={(scheduledAt) => void confirmMove(scheduledAt)}
      idPrefix="nurse-move"
    />
  );
}

export function CancelSessionDialog({
  referralId,
  session,
  student,
  open,
  onClose,
  onConfirmed,
  onChanged,
}: DialogProps & {
  referralId: string;
  session: NurseSessionItem;
  student: string;
  /** Fired the moment the cancel is confirmed — the page closes the sessions
      board too and the Dock reports the outcome. */
  onConfirmed: () => void;
}) {
  const dock = useDock();
  const queryClient = useQueryClient();

  if (!open) return null;

  // Same as moving: the Dock carries the request and the overlays close at
  // confirm; the wrapper unmounts, so toast + refresh run in this closure.
  async function confirmCancel(reason?: string) {
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "generic",
        title: "Cancelling clinic session",
        description: `${student} · ${formatDate(session.date)} · ${formatTime(session.scheduledAt)}`,
      });
    } catch {
      taskId = null;
    }
    onClose();
    onConfirmed();
    try {
      await cancelClinicSession(referralId, session.id, reason);
      markSelfNotified(referralId);
      invalidateNurseQueries(queryClient);
      toast.success({ title: "Session cancelled", description: "The session was cancelled." });
      onChanged();
      if (taskId) dock.completeTask(taskId);
    } catch (err) {
      if (taskId) {
        dock.failTask(
          taskId,
          apiErrorMessage(err, "Could not cancel the session. Try again."),
        );
      }
    }
  }

  return (
    <SharedCancelSessionDialog
      open
      onClose={onClose}
      onSubmit={(reason) => void confirmCancel(reason)}
      reasonLabel="Why is it cancelled? (optional)"
      idPrefix="nurse-cancel"
    />
  );
}

export function DeleteSessionDialog({
  referralId,
  session,
  open,
  onClose,
  onChanged,
}: DialogProps & { referralId: string; session: NurseSessionItem }) {
  const deleteMutation = useNurseMutation({
    mutationFn: () => deleteClinicSession(referralId, session.id),
    successTitle: "Session deleted",
    successDescription: () => "The cancelled session was removed.",
    errorFallback: "Could not delete the session. Try again.",
    silentError: true,
    sourceId: referralId,
    onSuccessExtra: () => {
      onClose();
      onChanged();
    },
  });
  const acting = deleteMutation.isPending;
  const serverError = deleteMutation.error
    ? apiErrorMessage(deleteMutation.error, "Could not delete the session. Try again.")
    : null;

  if (!open) return null;

  return (
    <SharedDeleteSessionDialog
      open
      onClose={() => {
        onClose();
        deleteMutation.reset();
      }}
      onConfirm={() => {
        // Close at once — the shared Dock reports the delete until it settles.
        onClose();
        deleteMutation.mutate();
      }}
      busy={acting}
      serverError={serverError}
    />
  );
}
