"use client";

import { CardModal } from "@/components/ui/CardModal";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { SheetStatus } from "./attendance-taking-data";
import styles from "./SubmitConfirmDialog.module.css";

interface SubmitConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextLabel: string;
  dateLabel: string;
  counts: Record<SheetStatus, number>;
  confirming?: boolean;
  onConfirm: () => void;
}

export function SubmitConfirmDialog({
  open,
  onOpenChange,
  contextLabel,
  dateLabel,
  counts,
  confirming = false,
  onConfirm,
}: SubmitConfirmDialogProps) {
  const parts = (Object.keys(counts) as SheetStatus[])
    .filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${s}`);

  return (
    <CardModal
      open={open}
      onClose={() => onOpenChange(false)}
      dismissable={!confirming}
      size="sm"
      title="Submit attendance?"
      description={
        <>
          {contextLabel} for {dateLabel} — {parts.join(", ")}.
        </>
      }
    >
      <p className={styles.note}>
        This locks the sheet for this subject and period. Students you did
        not mark are submitted as Present. You can still edit it afterwards
        from here.
      </p>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="destructive"
          onClick={() => onOpenChange(false)}
          disabled={confirming}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={confirming}
          aria-busy={confirming || undefined}
        >
          {confirming ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Submitting…
            </>
          ) : (
            "Confirm submit"
          )}
        </Button>
      </div>
    </CardModal>
  );
}
