"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { SessionDatePicker } from "./session-datetime-picker";
import type { GuidanceDialogProps } from "./guidance-dialog-props";
import styles from "./GuidanceReferralDialogs.module.css";
export function FollowUpDialog({
  dialogs,
  form,
  setForm,
  isActionPending,
  closeDialog,
  handleAction,
}: GuidanceDialogProps) {
  return (
    <KanbanOverlay
      open={dialogs.followUp}
      onClose={() => closeDialog("followUp")}
      dismissable={!isActionPending}
      busy={isActionPending}
      title="Set a check-back reminder"
      description="Pick a date to come back to this case."
      footer={
        <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
          <Button
            variant="destructive"
            className={styles.btnRed}
            onClick={() => closeDialog("followUp")}
            disabled={isActionPending}
          >
            Cancel
          </Button>
          <Button aria-busy={isActionPending || undefined}
            disabled={isActionPending || !form.followUpDate}
            onClick={() =>
              handleAction("followUp", { followUpDate: form.followUpDate })
            }
          >
            {isActionPending ? <Loader2 className={styles.spin} aria-hidden="true" /> : null}
            {isActionPending ? "Setting…" : "Set reminder"}
          </Button>
        </div>
      }
    >
      <div>
        <SessionDatePicker
          id="followUpDate"
          label="Check back on"
          value={form.followUpDate}
          onChange={(v) => setForm((f) => ({ ...f, followUpDate: v }))}
        />
      </div>
    </KanbanOverlay>
  );
}
