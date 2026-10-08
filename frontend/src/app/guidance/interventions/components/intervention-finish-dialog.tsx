"use client";
import type { FinishSessionFields } from "@/components/session-booking/FinishSessionDialog";
import { FinishSessionDialog as SharedFinishSessionDialog } from "@/components/session-booking/FinishSessionDialog";
import { SESSION_KIND_OPTIONS } from "@/lib/labels/sessions";
import type { CounselingSessionItem } from "@/services/guidance/interventions.types";
export function InterventionFinishDialog({
  open,
  onClose,
  activeSession,
  now,
  isActionPending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  activeSession: CounselingSessionItem | null;
  now: number;
  isActionPending: boolean;
  onSubmit: (fields: FinishSessionFields) => void;
}) {
  if (!open) return null;
  return (
    <SharedFinishSessionDialog
      open
      onClose={onClose}
      onSubmit={(fields) => onSubmit(fields)}
      notStarted={
        !!activeSession &&
        activeSession.status === "scheduled" &&
        new Date(activeSession.scheduledAt).getTime() > now
      }
      description={
        activeSession
          ? "Record what happened. If another talk is needed, book the follow-up below — otherwise, if this is the last open session, the follow-up closes on its own."
          : "Record what happened in this session."
      }
      followUpTitle="Book a follow-up session (optional)"
      followUpHint="If this needs another talk, book it now so it stays on the plan."
      followUpDateLabel="Follow-up date"
      followUpTimeLabel="Follow-up time"
      venuePlaceholder="e.g. Guidance office"
      showSessionType
      sessionTypeOptions={SESSION_KIND_OPTIONS}
      busy={isActionPending}
      idPrefix="iv-done"
    />
  );
}
