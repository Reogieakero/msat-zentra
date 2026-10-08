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
export function AdmDialog({
  dialogs,
  form,
  setForm,
  isActionPending,
  closeDialog,
  handleAction,
}: GuidanceDialogProps) {
  return (
    <Dialog open={dialogs.adm} onOpenChange={(next) => { if (!next && isActionPending) return; closeDialog("adm") }}>
      <DialogContent
        className={styles.dialogScrollHidden}
        aria-busy={isActionPending || undefined}
      >
        <DialogHeader>
          <DialogTitle>Start ADM process</DialogTitle>
          <DialogDescription>
            Move this case into ADM (Alternative Dispute Resolution) for
            closer follow-through.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="admReason">Why does this case need ADM?</Label>
          <Textarea
            id="admReason"
            value={form.admReason}
            onChange={(e) =>
              setForm((f) => ({ ...f, admReason: e.target.value }))
            }
            placeholder="Explain why this case needs closer follow-through…"
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            className={styles.btnRed}
            onClick={() => closeDialog("adm")}
            disabled={isActionPending}
          >
            Cancel
          </Button>
          <Button aria-busy={isActionPending || undefined}
            disabled={isActionPending || !form.admReason}
            onClick={() => handleAction("adm", { reason: form.admReason })}
          >
            {isActionPending ? <Loader2 className={styles.spin} aria-hidden="true" /> : null}
            {isActionPending ? "Starting…" : "Start ADM"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
