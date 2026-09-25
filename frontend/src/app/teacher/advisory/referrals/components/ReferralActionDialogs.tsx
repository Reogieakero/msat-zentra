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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

// Cancel modal (Dialog with reason, mirrors the guidance dismiss dialog):
// withdrawing a pending referral needs a recorded reason.
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
    <Dialog open={target !== null} onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this referral?</DialogTitle>
          <DialogDescription>
            {target ? (
              <>
                {target.studentName}&apos;s case will be withdrawn before the
                receiving desk acts on it. Please say why, so there is a record.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
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
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Keep referral
          </Button>
          <Button
            type="button"
            variant="destructive"
            className={styles.btnRed}
            disabled={pending || reason.trim() === ""}
            onClick={onConfirm}
          >
            {pending ? <Loader2 className={styles.spin} aria-hidden /> : null}
            {pending ? "Cancelling…" : "Cancel referral"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteDialogProps {
  target: ReferralActionTarget | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

// Delete modal (AlertDialog confirm, mirrors the coordinator confirm
// dialogs): permanently remove a cancelled referral from the list.
export function ReferralDeleteDialog({
  target,
  pending,
  error,
  onClose,
  onConfirm,
}: DeleteDialogProps) {
  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && !pending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this referral?</AlertDialogTitle>
          <AlertDialogDescription>
            {target ? (
              <>
                {target.studentName}&apos;s cancelled case will be permanently
                removed from your list. This cannot be undone.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className={styles.error}>{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className={styles.btnRed}
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={(e) => {
              // Hold the dialog open for the flight: success closes it via
              // the page clearing the target; failure leaves it open with
              // the error shown so the user can retry.
              e.preventDefault();
              onConfirm();
            }}
          >
            {pending ? <Loader2 className={styles.spin} aria-hidden /> : null}
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
