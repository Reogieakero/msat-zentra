"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookSessionDialog } from "@/components/session-booking/BookSessionDialog";
import { FinishSessionDialog as SharedFinishSessionDialog } from "@/components/session-booking/FinishSessionDialog";
import { RescheduleSessionDialog as SharedRescheduleSessionDialog } from "@/components/session-booking/RescheduleSessionDialog";
import { CancelSessionDialog as SharedCancelSessionDialog } from "@/components/session-booking/CancelSessionDialog";
import { DeleteSessionDialog as SharedDeleteSessionDialog } from "@/components/session-booking/DeleteSessionDialog";
import { apiErrorMessage } from "@/lib/api/errors";
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
import { useNurseMutation } from "../../overview/components/use-nurse-mutation";
import { refreshBookingReminders } from "@/components/notifications/BookingReminderStack";
import styles from "./NurseReferralDialogs.module.css";

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
      onSubmit={(fields) => bookMutation.mutate(fields)}
      description={`Book a clinic session${row.student ? ` for ${row.student}` : ""}. Held at the school clinic unless another venue is given.`}
      venuePlaceholder="e.g. School clinic"
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
  onChanged,
}: DialogProps & { referralId: string; session: NurseSessionItem }) {
  const [files, setFiles] = React.useState<File[]>([]);
  const [pickError, setPickError] = React.useState<string | null>(null);
  const finishUploadController = React.useRef<AbortController | null>(null);
  React.useEffect(() => {
    return () => finishUploadController.current?.abort();
  }, []);
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
        finishUploadController.current?.abort();
        const controller = new AbortController();
        finishUploadController.current = controller;
        await uploadClinicAttachments(referralId, session.id, files, {
          signal: controller.signal,
        });
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
    sourceId: referralId,
    onSuccessExtra: () => {
      onClose();
      setFiles([]);
      setPickError(null);
      onChanged();
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
    finishMutation.mutate(fields);
  }

  function handleClose() {
    finishUploadController.current?.abort();
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
        <div className={styles.formFull}>
          <Label htmlFor="nurse-done-files">Documentation photos (optional)</Label>
          <Input
            id="nurse-done-files"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={acting}
            onChange={(e) => onPickFiles(e.target.files)}
          />
          <p style={{ fontSize: "0.8125rem", opacity: 0.75, marginTop: "0.25rem" }}>
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
  open,
  onClose,
  onChanged,
}: DialogProps & { referralId: string; session: NurseSessionItem }) {
  const moveMutation = useNurseMutation({
    mutationFn: (scheduledAt: string) =>
      rescheduleClinicSession(referralId, session.id, scheduledAt),
    successTitle: "Session moved",
    successDescription: () => "The session was moved.",
    errorFallback: "Could not move the session. Try again.",
    silentError: true,
    sourceId: referralId,
    onSuccessExtra: () => {
      onClose();
      onChanged();
    },
  });
  const acting = moveMutation.isPending;
  const serverError = moveMutation.error
    ? apiErrorMessage(moveMutation.error, "Could not move the session. Try again.")
    : null;

  if (!open) return null;

  return (
    <SharedRescheduleSessionDialog
      open
      onClose={() => {
        onClose();
        moveMutation.reset();
      }}
      onSubmit={(scheduledAt) => moveMutation.mutate(scheduledAt)}
      busy={acting}
      serverError={serverError}
      idPrefix="nurse-move"
    />
  );
}

export function CancelSessionDialog({
  referralId,
  session,
  open,
  onClose,
  onChanged,
}: DialogProps & { referralId: string; session: NurseSessionItem }) {
  const cancelMutation = useNurseMutation({
    mutationFn: (reason?: string) => cancelClinicSession(referralId, session.id, reason),
    successTitle: "Session cancelled",
    successDescription: () => "The session was cancelled.",
    errorFallback: "Could not cancel the session. Try again.",
    silentError: true,
    sourceId: referralId,
    onSuccessExtra: () => {
      onClose();
      onChanged();
    },
  });
  const acting = cancelMutation.isPending;
  const serverError = cancelMutation.error
    ? apiErrorMessage(cancelMutation.error, "Could not cancel the session. Try again.")
    : null;

  if (!open) return null;

  return (
    <SharedCancelSessionDialog
      open
      onClose={() => {
        onClose();
        cancelMutation.reset();
      }}
      onSubmit={(reason) => cancelMutation.mutate(reason)}
      reasonLabel="Why is it cancelled? (optional)"
      busy={acting}
      serverError={serverError}
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
      onConfirm={() => deleteMutation.mutate()}
      busy={acting}
      serverError={serverError}
    />
  );
}
