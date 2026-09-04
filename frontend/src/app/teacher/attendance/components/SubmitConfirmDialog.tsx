"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { SheetStatus } from "./attendance-taking-data";
import styles from "./SubmitConfirmDialog.module.css";

interface SubmitConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionLabel: string;
  dateLabel: string;
  counts: Record<SheetStatus, number>;
  confirming?: boolean;
  onConfirm: () => void;
}

export function SubmitConfirmDialog({
  open,
  onOpenChange,
  sessionLabel,
  dateLabel,
  counts,
  confirming = false,
  onConfirm,
}: SubmitConfirmDialogProps) {
  const parts = (Object.keys(counts) as SheetStatus[])
    .filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${s}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog}>
        <DialogHeader>
          <DialogTitle>Submit attendance?</DialogTitle>
          <DialogDescription>
            {sessionLabel} session for {dateLabel} — {parts.join(", ")}.
          </DialogDescription>
        </DialogHeader>
        <p className={styles.note}>
          This locks the sheet for this session. You can still edit it afterwards from here.
        </p>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={confirming}>
            {confirming ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Submitting…
              </>
            ) : (
              "Confirm submit"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
