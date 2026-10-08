"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <Dialog
      open={dialogs.followUp}
      onOpenChange={(next) => { if (!next && isActionPending) return; closeDialog("followUp") }}
    >
      <DialogContent
        className={styles.dialogScrollHidden}
        aria-busy={isActionPending || undefined}
      >
        <DialogHeader>
          <DialogTitle>Set a check-back reminder</DialogTitle>
          <DialogDescription>
            Pick a date to come back to this case.
          </DialogDescription>
        </DialogHeader>
        <div>
          <SessionDatePicker
            id="followUpDate"
            label="Check back on"
            value={form.followUpDate}
            onChange={(v) => setForm((f) => ({ ...f, followUpDate: v }))}
          />
        </div>
        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
