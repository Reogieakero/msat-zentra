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
export function ResolveDialog({
  dialogs,
  form,
  setForm,
  activeRow,
  isActionPending,
  mutationIsPending,
  closeDialog,
  onResolveCase,
}: GuidanceDialogProps) {
  return (
    <Dialog open={dialogs.resolve} onOpenChange={(next) => { if (!next && isActionPending) return; closeDialog("resolve") }}>
      <DialogContent
        className={styles.dialogScrollHidden}
        aria-busy={isActionPending || undefined}
      >
        <DialogHeader>
          <DialogTitle>Finish and close case</DialogTitle>
          <DialogDescription>
            Closing needs two things: at least one finished session and a
            closing summary.
          </DialogDescription>
        </DialogHeader>
        <p className={styles.resolveProgress} aria-live="polite">
          {activeRow
            ? `${activeRow.completedSessions} of ${activeRow.sessions.length} session${activeRow.sessions.length === 1 ? "" : "s"} finished`
            : "No case selected"}
        </p>
        {activeRow && activeRow.completedSessions === 0 ? (
          <p className={styles.resolveBlocker} role="note">
            Finish at least one session first — use “Schedule a session” in
            the counseling plan, then mark it done.
          </p>
        ) : null}
        <div>
          <Label htmlFor="resolveSummary">Closing summary</Label>
          <Textarea
            id="resolveSummary"
            value={form.resolveSummary}
            onChange={(e) =>
              setForm((f) => ({ ...f, resolveSummary: e.target.value }))
            }
            placeholder="What changed for the student? What was the final outcome…"
            maxLength={2000}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => closeDialog("resolve")}
            disabled={mutationIsPending}
          >
            Keep open
          </Button>
          <Button
            disabled={
              mutationIsPending ||
              isActionPending ||
              !activeRow ||
              !form.resolveSummary.trim() ||
              activeRow.completedSessions === 0
            }
            onClick={() => {
              if (!activeRow) return;
              onResolveCase(activeRow.id, form.resolveSummary.trim());
            }}
          >
            {mutationIsPending ? <Loader2 className={styles.spin} aria-hidden="true" /> : null}
            {mutationIsPending ? "Closing…" : "Close case"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
