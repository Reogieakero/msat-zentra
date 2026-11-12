"use client";
import { CancelSessionDialog } from "@/components/session-booking/CancelSessionDialog";
import { sessionTypeLabel } from "@/lib/labels/sessions";
import { formatActionTime } from "../../referrals/components/guidance-referrals-format";
import type { CounselingSessionItem } from "@/services/guidance/interventions.types";

export function InterventionCancelDialog({
  open,
  onClose,
  activeSession,
  isActionPending,
  onSubmit,
  serverError = null,
}: {
  open: boolean;
  onClose: () => void;
  activeSession: CounselingSessionItem | null;
  isActionPending: boolean;
  onSubmit: (reason?: string) => void;
  serverError?: string | null;
}) {
  if (!open) return null;
  // Shared kanban-overlay confirmation — same surface as the referrals desk so
  // the whole guidance shell cancels a booking the same way.
  return (
    <CancelSessionDialog
      open
      onClose={onClose}
      onSubmit={onSubmit}
      title="Cancel this session?"
      description={
        activeSession
          ? `${sessionTypeLabel(activeSession.sessionType)} · ${formatActionTime(activeSession.scheduledAt)} will be cancelled.`
          : "This session will be cancelled."
      }
      keepLabel="Keep session"
      busy={isActionPending}
      serverError={serverError}
      idPrefix="iv-cancel"
    />
  );
}
