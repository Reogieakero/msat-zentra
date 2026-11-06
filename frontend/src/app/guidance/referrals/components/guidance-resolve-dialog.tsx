"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
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
    <KanbanOverlay
      open={dialogs.resolve}
      onClose={() => closeDialog("resolve")}
      dismissable={!isActionPending}
      busy={isActionPending}
      width="lg"
      title="Finish and close case"
      description="Closing needs two things: at least one finished session and a closing summary."
      footer={
        <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
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
        </div>
      }
    >
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
    </KanbanOverlay>
  );
}
