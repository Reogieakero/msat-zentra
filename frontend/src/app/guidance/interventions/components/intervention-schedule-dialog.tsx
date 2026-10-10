"use client";
import { BookSessionDialog, type BookSessionDialogProps, type BookSessionFields } from "@/components/session-booking/BookSessionDialog";
import { SESSION_KIND_OPTIONS } from "@/lib/labels/sessions";
import { fetchDaySchedule } from "@/services/guidance/sessions.service";
export function InterventionScheduleDialog({
  open,
  onClose,
  studentCard,
  hasActiveSession,
  isActionPending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  studentCard: BookSessionDialogProps["studentCard"];
  hasActiveSession: boolean;
  isActionPending: boolean;
  onSubmit: (fields: BookSessionFields) => void;
}) {
  if (!open) return null;
  return (
    <BookSessionDialog
      open
      onClose={onClose}
      onSubmit={(fields) => onSubmit(fields)}
      studentCard={studentCard}
      fetchTakenTimes={(dateKey, signal) => fetchDaySchedule(dateKey, { signal })}
      venueHint="Held at the guidance office unless another venue is given."
      venuePlaceholder="Guidance office"
      showSessionType
      sessionTypeOptions={SESSION_KIND_OPTIONS}
      hasActiveSession={hasActiveSession}
      busy={isActionPending}
      idPrefix="iv-sess"
    />
  );
}
