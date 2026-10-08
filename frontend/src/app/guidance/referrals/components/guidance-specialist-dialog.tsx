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
export function SpecialistDialog({
  dialogs,
  form,
  setForm,
  isActionPending,
  closeDialog,
  handleAction,
}: GuidanceDialogProps) {
  return (
    <Dialog
      open={dialogs.specialist}
      onOpenChange={(next) => { if (!next && isActionPending) return; closeDialog("specialist") }}
    >
      <DialogContent
        className={styles.dialogScrollHidden}
        aria-busy={isActionPending || undefined}
      >
        <DialogHeader>
          <DialogTitle>Ask a specialist for help</DialogTitle>
          <DialogDescription>
            Send this case to a specialist office.
          </DialogDescription>
        </DialogHeader>
        <div className={styles.formGrid}>
          <div>
            <FormDropdown
              id="specialistRole"
              label="Send to"
              value={form.specialistRole}
              onChange={(v) =>
                setForm((f) => ({ ...f, specialistRole: v }))
              }
              placeholder="Pick a specialist"
              options={[
                { value: "nurse", label: "Nurse" },
                { value: "adm_coordinator", label: "ADM Coordinator" },
                { value: "principal", label: "Principal" },
              ]}
            />
          </div>
          <div className={styles.formFull}>
            <Label htmlFor="specialistReason">What help is needed?</Label>
            <Textarea
              id="specialistReason"
              value={form.specialistReason}
              onChange={(e) =>
                setForm((f) => ({ ...f, specialistReason: e.target.value }))
              }
              placeholder="Explain what help the student needs…"
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            className={styles.btnRed}
            onClick={() => closeDialog("specialist")}
            disabled={isActionPending}
          >
            Cancel
          </Button>
          <Button aria-busy={isActionPending || undefined}
            disabled={
              isActionPending ||
              !form.specialistRole ||
              !form.specialistReason
            }
            onClick={() =>
              handleAction("specialist", {
                referredToRole: form.specialistRole,
                reason: form.specialistReason,
              })
            }
          >
            {isActionPending ? <Loader2 className={styles.spin} aria-hidden="true" /> : null}
            {isActionPending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
