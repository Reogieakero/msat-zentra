"use client";
import { RescheduleSessionDialog as SharedRescheduleSessionDialog } from "@/components/session-booking/RescheduleSessionDialog";
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
    <SharedRescheduleSessionDialog
      open
      onClose={onClose}
      onSubmit={(scheduledAt) => onSubmit(scheduledAt)}
      description={
        activeSession
          ? `Currently ${formatActionTime(activeSession.scheduledAt)}. Pick the new date and time.`
          : "Pick the new date and time."
      }
      busy={isActionPending}
      idPrefix="iv-move"
    />
  );
}
