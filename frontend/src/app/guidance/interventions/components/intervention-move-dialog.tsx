"use client";
import { BookSessionDialog } from "@/components/session-booking/BookSessionDialog";
import { SESSION_KIND_OPTIONS } from "@/lib/labels/sessions";
import { toDateInputValue, toTimeInputValue } from "@/lib/labels/datetime";
import { fetchDaySchedule } from "@/services/guidance/sessions.service";
import { formatActionTime } from "../../referrals/components/guidance-referrals-format";
import type { CounselingSessionItem } from "@/services/guidance/interventions.types";
export function InterventionMoveDialog({
  open,
  onClose,
  activeSession,
  isActionPending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  activeSession: CounselingSessionItem | null;
  isActionPending: boolean;
  onSubmit: (scheduledAt: string) => void;
}) {
  if (!open) return null;
  return (
    <BookSessionDialog
      open
      onClose={onClose}
      onSubmit={(fields) => onSubmit(fields.scheduledAt)}
      description={
        activeSession
          ? `Currently ${formatActionTime(activeSession.scheduledAt)}. Pick the new date and time.`
          : "Pick the new date and time."
      }
      fetchTakenTimes={(dateKey, signal) => fetchDaySchedule(dateKey, { signal })}
      venueHint="Held at the guidance office unless another venue is given."
      venuePlaceholder="Guidance office"
      showSessionType
      sessionTypeOptions={SESSION_KIND_OPTIONS}
      hasActiveSession={false}
      busy={isActionPending}
      idPrefix="iv-move"
      title="Move session"
      submitLabel="Move session"
      busyLabel="Moving…"
      initialDate={activeSession ? toDateInputValue(activeSession.scheduledAt) : ""}
      initialTime={activeSession ? toTimeInputValue(activeSession.scheduledAt) : ""}
      initialVenue={activeSession?.venue ?? ""}
      initialSessionType={activeSession?.sessionType}
    />
  );
}
