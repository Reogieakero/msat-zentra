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
    <Dialog
      open={dialogs.dismiss}
      onOpenChange={(next) => { if (!next && isActionPending) return; closeDialog("dismiss") }}
    >
      <DialogContent
        className={styles.dialogScrollHidden}
        aria-busy={isActionPending || undefined}
      >
        <DialogHeader>
          <DialogTitle>Close without action</DialogTitle>
          <DialogDescription>
            Close this case. Please say why, so there is a record.
          </DialogDescription>
        </DialogHeader>
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
        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
