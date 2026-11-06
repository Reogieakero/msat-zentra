"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
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
  const open = target !== null;
  const reasonRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Lock page scroll while the board is up and start typing in the reason
  // field as soon as it opens.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // The overlay mounts on its own effect pass, so focus on the next tick.
    const t = window.setTimeout(() => reasonRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <KanbanOverlay
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      dismissable={!pending}
      title="Cancel this referral?"
      ariaLabel="Cancel this referral"
      icon={
        <span className="text-red-500" aria-hidden>
          <span className="block h-2 w-2 rounded-full bg-red-500" />
        </span>
      }
      description={
        target
          ? `${target.studentName}'s case will be withdrawn before the receiving desk acts on it.`
          : undefined
      }
      width="md"
      footer={
        <div className="flex items-center justify-end gap-2 px-1 pb-1">
          <Button
            type="button"
            variant="outline"
            className="h-6 px-2.5 text-xs"
            onClick={onClose}
            disabled={pending}
          >
            Keep referral
          </Button>
          <Button
            type="button"
            variant="destructive"
            className={`${styles.btnRed} h-6 px-2.5 text-xs`}
            disabled={pending || reason.trim() === ""}
            aria-busy={pending || undefined}
            onClick={onConfirm}
          >
            {pending ? <Loader2 className={styles.spin} aria-hidden /> : null}
            {pending ? "Cancelling…" : "Cancel referral"}
          </Button>
        </div>
      }
    >
      <div className="flex min-w-0 flex-col gap-1.5 px-1 pb-1">
        <Label htmlFor="referral-cancel-reason">Why is this being cancelled?</Label>
        <Textarea
          ref={reasonRef}
          id="referral-cancel-reason"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Explain why this referral is no longer needed…"
          rows={3}
          maxLength={500}
        />
        {error ? (
          <p role="alert" className="text-xs leading-snug text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </div>
    </KanbanOverlay>
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
