"use client";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Busy } from "./busy";
export function InterventionChangeDialog({
  open,
  onClose,
  activeStudent,
  actionText,
  onActionText,
  isActionPending,
  onSubmit,
  canSubmit,
}: {
  open: boolean;
  onClose: () => void;
  activeStudent: string | null;
  actionText: string;
  onActionText: (v: string) => void;
  isActionPending: boolean;
  onSubmit: () => void;
  canSubmit: boolean;
}) {
  return (
    <KanbanOverlay
      open={open}
      onClose={onClose}
      dismissable={!isActionPending}
      busy={isActionPending}
      width="lg"
      title="Change the follow-up plan"
      description={
        activeStudent
          ? `Adjust what should happen for ${activeStudent}. This counts as your review.`
          : "Adjust the recommended action."
      }
      footer={
        <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isActionPending}
          >
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={onSubmit}>
            <Busy busy={isActionPending} />
            {isActionPending ? "Saving…" : "Save change"}
          </Button>
        </div>
      }
    >
      <div>
        <Label htmlFor="changedAction">Adjusted action</Label>
        <Textarea
          id="changedAction"
          value={actionText}
          onChange={(e) => onActionText(e.target.value)}
          placeholder="Write what should happen instead…"
          maxLength={2000}
        />
      </div>
    </KanbanOverlay>
  );
}
