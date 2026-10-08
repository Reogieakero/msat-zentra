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
export function NoteDialog({
  dialogs,
  form,
  setForm,
  isActionPending,
  closeDialog,
  handleAction,
}: GuidanceDialogProps) {
  return (
    <Dialog open={dialogs.note} onOpenChange={(next) => { if (!next && isActionPending) return; closeDialog("note") }}>
      <DialogContent
        className={styles.dialogScrollHidden}
        aria-busy={isActionPending || undefined}
      >
        <DialogHeader>
          <DialogTitle>Add a private note</DialogTitle>
          <DialogDescription>
            Only guidance staff can see this note.
          </DialogDescription>
        </DialogHeader>
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
        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
