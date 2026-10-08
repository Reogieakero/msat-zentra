"use client";
import { CancelSessionDialog as SharedCancelSessionDialog } from "@/components/session-booking/CancelSessionDialog";
export function InterventionCancelDialog({
  open,
  onClose,
  isActionPending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  isActionPending: boolean;
  onSubmit: (reason?: string) => void;
}) {
  if (!open) return null;
  return (
    <SharedCancelSessionDialog
      open
      onClose={onClose}
      onSubmit={(reason) => onSubmit(reason)}
      description="This session will be cancelled."
      keepLabel="Keep session"
      busy={isActionPending}
      idPrefix="iv-cancel"
    />
  );
}
