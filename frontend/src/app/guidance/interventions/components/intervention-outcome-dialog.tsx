"use client";
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
import { FormDropdown } from "../../referrals/components/form-dropdown";
import type { AtRiskStudentItem, InterventionOutcome } from "@/services/guidance/interventions.types";
import { Busy } from "./busy";
import styles from "./intervention-dialogs.module.css";
export function InterventionOutcomeDialog({
  open,
  onClose,
  activeRow,
  followUp,
  outcomeStatus,
  onOutcomeStatus,
  outcomeNotes,
  onOutcomeNotes,
  isActionPending,
  onSubmit,
  canSubmit,
}: {
  open: boolean;
  onClose: () => void;
  activeRow: AtRiskStudentItem | null;
  followUp: AtRiskStudentItem["intervention"];
  outcomeStatus: InterventionOutcome;
  onOutcomeStatus: (v: InterventionOutcome) => void;
  outcomeNotes: string;
  onOutcomeNotes: (v: string) => void;
  isActionPending: boolean;
  onSubmit: () => void;
  canSubmit: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(n) => { if (!n && !isActionPending) onClose() }}
    >
      <DialogContent aria-busy={isActionPending || undefined}>
        <DialogHeader>
          <DialogTitle>Record the outcome</DialogTitle>
          <DialogDescription>
            Closing needs two things: at least one finished session and a
            closing note — unless the student is no longer at risk, which
            can be discontinued with a closing note alone.
          </DialogDescription>
        </DialogHeader>
        <p className={styles.resolveProgress} aria-live="polite">
          {followUp
            ? `${followUp.completedSessions} of ${followUp.sessions.length} session${followUp.sessions.length === 1 ? "" : "s"} finished`
            : "No follow-up selected"}
        </p>
        {followUp &&
        followUp.completedSessions === 0 &&
        !(
          activeRow?.riskLevel === "Low" &&
          followUp.approvalStatus !== "pending"
        ) ? (
          <p className={styles.blocker} role="note">
            Finish at least one session first — schedule one in the
            counseling plan above, then mark it done.
          </p>
        ) : null}
        {followUp &&
        followUp.completedSessions === 0 &&
        activeRow?.riskLevel === "Low" &&
        followUp.approvalStatus !== "pending" ? (
          <p className={styles.blocker} role="note">
            No sessions finished — but this student is no longer at risk,
            so you can close this as “Closed — not resolved” with a closing
            note.
          </p>
        ) : null}
        {followUp?.approvalStatus === "pending" ? (
          <p className={styles.blocker} role="note">
            Review this follow-up first — it can only be closed after
            approval. You can still save a progress note as “Still ongoing”.
          </p>
        ) : null}
        {activeRow?.intervention?.outcomeStatus === "resolved" ? (
          <p className={styles.blocker} role="note">
            This follow-up is closed — you can still update the closing
            notes below. The status stays resolved.
          </p>
        ) : null}
        <div className={styles.formGrid}>
          <FormDropdown
            id="outcomeStatus"
            label="Where does this stand?"
            value={outcomeStatus}
            onChange={(v) => onOutcomeStatus(v as InterventionOutcome)}
            placeholder="Pick a status"
            options={[
              { value: "ongoing", label: "Still ongoing" },
              { value: "resolved", label: "Resolved — goal met" },
              { value: "unresolved", label: "Closed — not resolved" },
            ]}
            disabled={activeRow?.intervention?.outcomeStatus === "resolved"}
          />
          <div className={styles.formFull}>
            <Label htmlFor="outcomeNotes">
              Progress note (required when closing)
            </Label>
            <Textarea
              id="outcomeNotes"
              value={outcomeNotes}
              onChange={(e) => onOutcomeNotes(e.target.value)}
              placeholder="What changed for the student? What was the final outcome…"
              maxLength={2000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isActionPending}
          >
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={onSubmit}>
            <Busy busy={isActionPending} />
            {isActionPending ? "Saving…" : "Save outcome"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
