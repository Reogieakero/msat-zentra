"use client";
import { BookSessionDialog, type BookSessionFields } from "@/components/session-booking/BookSessionDialog";
import { SESSION_KIND_OPTIONS } from "@/lib/labels/sessions";
export function InterventionScheduleDialog({
  open,
  onClose,
  activeStudent,
  hasActiveSession,
  isActionPending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  activeStudent: string | null;
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
      description={
        activeStudent
          ? `Book a counseling session for ${activeStudent}.`
          : "Book a counseling session."
      }
      venueHint="Held at the guidance office unless another venue is given."
      venuePlaceholder="e.g. Guidance office"
      showSessionType
      sessionTypeOptions={SESSION_KIND_OPTIONS}
      hasActiveSession={hasActiveSession}
      busy={isActionPending}
      idPrefix="iv-sess"
    />
  );
}
