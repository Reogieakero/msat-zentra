"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
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
    <KanbanOverlay
      open={dialogs.reassign}
      onClose={() => closeDialog("reassign")}
      dismissable={!isActionPending}
      busy={isActionPending}
      title="Pass to someone else"
      description="Hand this case to another office. It will show up in their queue."
      footer={
        <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
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
        </div>
      }
    >
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
    </KanbanOverlay>
  );
}
