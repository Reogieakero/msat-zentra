"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
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
  const open = target !== null;
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const reasonRef = React.useRef<HTMLTextAreaElement | null>(null);
  // Portal to document.body so no transformed ancestor can hijack the fixed
  // overlay as its containing block. Mounted flag guards server prerender.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open || pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  React.useEffect(() => {
    if (!open || pending) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the reason field so typing can start immediately.
    reasonRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, pending]);

  if (!open || !mounted) return null;

  const close = () => {
    if (!pending) onClose();
  };

  return createPortal(
    <>
      {!pending ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-4 animate-in fade-in-0 duration-150 dark:bg-black/70"
          onMouseDown={(e) => {
            if (!pending && e.target === e.currentTarget) onClose();
          }}
        >
          <div
            ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="referral-cancel-title"
        aria-describedby="referral-cancel-desc"
        tabIndex={-1}
        className="flex w-full max-w-md min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted p-2.5 shadow-xl [font-family:var(--font-inter)] animate-in fade-in-0 zoom-in-95 duration-150 dark:bg-muted/20"
      >
        <div className="-mx-2.5 flex min-w-0 items-center gap-1.5 border-b border-border px-3.5 pb-2">
          <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-semibold">
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
            <span id="referral-cancel-title" className="truncate">
              Cancel this referral?
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            className="h-6 w-6 shrink-0 px-0"
            onClick={close}
            disabled={pending}
            aria-label="Close dialog"
          >
            <X size={14} strokeWidth={1.8} aria-hidden />
          </Button>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-white p-3 text-left shadow-sm dark:bg-card">
          <p id="referral-cancel-desc" className="text-[13px] leading-snug text-muted-foreground">
            {target?.studentName}&apos;s case will be withdrawn before the
            receiving desk acts on it. Please say why, so there is a record.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-white p-3 text-left shadow-sm dark:bg-card">
          <div className={styles.field}>
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
          </div>
          {error ? (
            <p role="alert" className="text-xs leading-snug text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
        </div>
        <div className="-mx-2.5 flex justify-end gap-2 border-t border-border px-3.5 pt-2">
          <Button
            type="button"
            variant="outline"
            className="h-6 px-2.5 text-xs"
            onClick={close}
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
      </div>
    </div>
      ) : null}
    </>,
    document.body,
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
