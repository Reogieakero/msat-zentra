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
    <Dialog open={open} onOpenChange={(n) => { if (!n && !isActionPending) onClose() }}>
      <DialogContent aria-busy={isActionPending || undefined}>
        <DialogHeader>
          <DialogTitle>Change the follow-up plan</DialogTitle>
          <DialogDescription>
            {activeStudent
              ? `Adjust what should happen for ${activeStudent}. This counts as your review.`
              : "Adjust the recommended action."}
          </DialogDescription>
        </DialogHeader>
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
            {isActionPending ? "Saving…" : "Save change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
