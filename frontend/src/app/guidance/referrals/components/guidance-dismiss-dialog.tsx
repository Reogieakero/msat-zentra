"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GuidanceDialogProps } from "./guidance-dialog-props";
import styles from "./GuidanceReferralDialogs.module.css";
export function DismissDialog({
  dialogs,
  form,
  setForm,
  isActionPending,
  closeDialog,
  handleAction,
}: GuidanceDialogProps) {
  return (
    <KanbanOverlay
      open={dialogs.dismiss}
      onClose={() => closeDialog("dismiss")}
      dismissable={!isActionPending}
      busy={isActionPending}
      title="Close without action"
      description="Close this case. Please say why, so there is a record."
      footer={
        <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
          <Button
            variant="destructive"
            className={styles.btnRed}
            onClick={() => closeDialog("dismiss")}
            disabled={isActionPending}
          >
            Cancel
          </Button>
          <Button aria-busy={isActionPending || undefined}
            disabled={isActionPending || !form.dismissReason}
            onClick={() =>
              handleAction("dismiss", { reason: form.dismissReason })
            }
          >
            {isActionPending ? <Loader2 className={styles.spin} aria-hidden="true" /> : null}
            {isActionPending ? "Closing…" : "Close case"}
          </Button>
        </div>
      }
    >
      <div>
        <Label htmlFor="dismissReason">Why is this being closed?</Label>
        <Textarea
          id="dismissReason"
          value={form.dismissReason}
          onChange={(e) =>
            setForm((f) => ({ ...f, dismissReason: e.target.value }))
          }
          placeholder="Explain why no further action is needed…"
          maxLength={500}
        />
      </div>
    </KanbanOverlay>
  );
}
