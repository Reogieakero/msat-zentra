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
import { FormDropdown } from "./form-dropdown";
import type { GuidanceDialogProps } from "./guidance-dialog-props";
import styles from "./GuidanceReferralDialogs.module.css";
export function EscalateDialog({
  dialogs,
  form,
  setForm,
  isActionPending,
  closeDialog,
  handleAction,
}: GuidanceDialogProps) {
  return (
    <Dialog
      open={dialogs.escalate}
      onOpenChange={(next) => { if (!next && isActionPending) return; closeDialog("escalate") }}
    >
      <DialogContent
        className={styles.dialogScrollHidden}
        aria-busy={isActionPending || undefined}
      >
        <DialogHeader>
          <DialogTitle>Send to a higher office</DialogTitle>
          <DialogDescription>
            Send this case up when it needs attention beyond guidance.
          </DialogDescription>
        </DialogHeader>
        <div className={styles.formGrid}>
          <div>
            <FormDropdown
              id="escalatedTo"
              label="Send to"
              value={form.escalatedTo}
              onChange={(v) => setForm((f) => ({ ...f, escalatedTo: v }))}
              placeholder="Pick an office"
              options={[
                { value: "principal", label: "Principal" },
                { value: "nurse", label: "Nurse" },
                { value: "adm_coordinator", label: "ADM Coordinator" },
              ]}
            />
          </div>
          <div className={styles.formFull}>
            <Label htmlFor="escalationReason">Why does this need to go higher?</Label>
            <Textarea
              id="escalationReason"
              value={form.escalationReason}
              onChange={(e) =>
                setForm((f) => ({ ...f, escalationReason: e.target.value }))
              }
              placeholder="Explain what is happening and what help is needed…"
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            className={styles.btnRed}
            onClick={() => closeDialog("escalate")}
            disabled={isActionPending}
          >
            Cancel
          </Button>
          <Button aria-busy={isActionPending || undefined}
            disabled={
              isActionPending ||
              !form.escalatedTo ||
              !form.escalationReason
            }
            onClick={() =>
              handleAction("escalate", {
                escalationReason: form.escalationReason,
                escalatedTo: form.escalatedTo,
              })
            }
          >
            {isActionPending ? <Loader2 className={styles.spin} aria-hidden="true" /> : null}
            {isActionPending ? "Sending…" : "Send up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
