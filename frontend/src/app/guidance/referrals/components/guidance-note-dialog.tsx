"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GuidanceDialogProps } from "./guidance-dialog-props";
import styles from "./GuidanceReferralDialogs.module.css";
export function NoteDialog({
  dialogs,
  form,
  setForm,
  isActionPending,
  closeDialog,
  handleAction,
}: GuidanceDialogProps) {
  return (
    <KanbanOverlay
      open={dialogs.note}
      onClose={() => closeDialog("note")}
      dismissable={!isActionPending}
      busy={isActionPending}
      title="Add a private note"
      description="Only guidance staff can see this note."
      footer={
        <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
          <Button
            variant="destructive"
            className={styles.btnRed}
            onClick={() => closeDialog("note")}
            disabled={isActionPending}
          >
            Cancel
          </Button>
          <Button aria-busy={isActionPending || undefined}
            disabled={isActionPending || !form.noteText}
            onClick={() => handleAction("note", { notes: form.noteText })}
          >
            {isActionPending ? <Loader2 className={styles.spin} aria-hidden="true" /> : null}
            {isActionPending ? "Saving…" : "Save note"}
          </Button>
        </div>
      }
    >
      <div>
        <Label htmlFor="noteText">Note</Label>
        <Textarea
          id="noteText"
          value={form.noteText}
          onChange={(e) =>
            setForm((f) => ({ ...f, noteText: e.target.value }))
          }
          placeholder="Write your note here…"
          maxLength={2000}
        />
      </div>
    </KanbanOverlay>
  );
}
