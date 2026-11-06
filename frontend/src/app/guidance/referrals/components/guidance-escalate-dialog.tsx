"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
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
    <KanbanOverlay
      open={dialogs.escalate}
      onClose={() => closeDialog("escalate")}
      dismissable={!isActionPending}
      busy={isActionPending}
      width="lg"
      title="Send to a higher office"
      description="Send this case up when it needs attention beyond guidance."
      footer={
        <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
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
        </div>
      }
    >
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
    </KanbanOverlay>
  );
}
