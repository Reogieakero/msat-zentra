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
import { FormDropdown } from "./form-dropdown";
import type { GuidanceDialogProps } from "./guidance-dialog-props";
import styles from "./GuidanceReferralDialogs.module.css";
export function ReassignDialog({
  dialogs,
  form,
  setForm,
  isActionPending,
  closeDialog,
  handleAction,
}: GuidanceDialogProps) {
  return (
    <Dialog
      open={dialogs.reassign}
      onOpenChange={(next) => { if (!next && isActionPending) return; closeDialog("reassign") }}
    >
      <DialogContent
        className={styles.dialogScrollHidden}
        aria-busy={isActionPending || undefined}
      >
        <DialogHeader>
          <DialogTitle>Pass to someone else</DialogTitle>
          <DialogDescription>
            Hand this case to another office. It will show up in their queue.
          </DialogDescription>
        </DialogHeader>
        <div>
          <FormDropdown
            id="reassignRole"
            label="Pass to"
            value={form.specialistRole}
            onChange={(v) => setForm((f) => ({ ...f, specialistRole: v }))}
            placeholder="Pick an office"
            options={[
              { value: "nurse", label: "Nurse" },
              { value: "guidance_counselor", label: "Guidance Counselor" },
              { value: "adm_coordinator", label: "ADM Coordinator" },
              { value: "principal", label: "Principal" },
            ]}
          />
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            className={styles.btnRed}
            onClick={() => closeDialog("reassign")}
            disabled={isActionPending}
          >
            Cancel
          </Button>
          <Button aria-busy={isActionPending || undefined}
            disabled={isActionPending || !form.specialistRole}
            onClick={() =>
              handleAction("reassign", {
                referredToRole: form.specialistRole,
              })
            }
          >
            {isActionPending ? <Loader2 className={styles.spin} aria-hidden="true" /> : null}
            {isActionPending ? "Passing…" : "Pass case"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
