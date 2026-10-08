"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import styles from "./ReferralActionDialogs.module.css";

export interface ReferralActionTarget {
  id: string;
  studentName: string;
}

interface CancelDialogProps {
  target: ReferralActionTarget | null;
  reason: string;
  onReasonChange: (next: string) => void;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function ReferralCancelDialog({
  target,
  reason,
  onReasonChange,
  pending,
  error,
  onClose,
  onConfirm,
}: CancelDialogProps) {
  return (
    <CardModal
      open={target !== null}
      onClose={() => {
        if (!pending) onClose();
      }}
      dismissable={!pending}
      size="sm"
      title="Cancel this referral?"
      description={
        target ? (
          <>
            {target.studentName}&apos;s case will be withdrawn before the
            receiving desk acts on it. Please say why, so there is a record.
          </>
        ) : undefined
      }
    >
      <div className={styles.field}>
        <Label htmlFor="referral-cancel-reason">Why is this being cancelled?</Label>
        <Textarea
          id="referral-cancel-reason"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Explain why this referral is no longer needed…"
          rows={3}
          maxLength={500}
        />
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Keep referral
        </Button>
        <Button
          type="button"
          variant="destructive"
          className={styles.btnRed}
          disabled={pending || reason.trim() === ""}
          aria-busy={pending || undefined}
          onClick={onConfirm}
        >
          {pending ? <Loader2 className={styles.spin} aria-hidden /> : null}
          {pending ? "Cancelling…" : "Cancel referral"}
        </Button>
      </div>
    </CardModal>
  );
}

interface DeleteDialogProps {
  target: ReferralActionTarget | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function ReferralDeleteDialog({
  target,
  pending,
  error,
  onClose,
  onConfirm,
}: DeleteDialogProps) {
  return (
    <CardModal
      open={target !== null}
      onClose={() => {
        if (!pending) onClose();
      }}
      dismissable={!pending}
      size="sm"
      title="Delete this referral?"
      description={
        target ? (
          <>
            {target.studentName}&apos;s cancelled case will be permanently
            removed from your list. This cannot be undone.
          </>
        ) : undefined
      }
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="destructive"
          onClick={onClose}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          className={styles.btnRed}
          disabled={pending}
          aria-busy={pending || undefined}
          onClick={() => {
            onConfirm();
          }}
        >
          {pending ? <Loader2 className={styles.spin} aria-hidden /> : null}
          {pending ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </CardModal>
  );
}
