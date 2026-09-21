"use client";

import * as React from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import styles from "./BookSessionDialog.module.css";

interface CancelSessionDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason?: string) => void;
  title?: string;
  description?: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  keepLabel?: string;
  submitLabel?: string;
  busy?: boolean;
  /** Save failure from the caller's API call. */
  serverError?: string | null;
  idPrefix?: string;
}

/**
 * Shared cancel-session modal — optional reason, solid-red confirm. The
 * caller performs the save.
 */
export function CancelSessionDialog({
  open,
  onClose,
  onSubmit,
  title = "Cancel this session?",
  description = "This frees the slot. The case itself stays open.",
  reasonLabel = "Why? (optional)",
  reasonPlaceholder = "Reason for cancelling…",
  keepLabel = "Keep it",
  submitLabel = "Cancel session",
  busy = false,
  serverError = null,
  idPrefix = "cancel-session",
}: CancelSessionDialogProps) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Fresh form every time the modal opens — synced during render, never
  // in an effect.
  const openKey = open ? idPrefix : null;
  const [prevOpenKey, setPrevOpenKey] = React.useState<string | null>(null);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    setReason("");
    setError(null);
  }

  if (!open) return null;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose();
          setError(null);
        }
      }}
    >
      <DialogContent className={styles.dialogScrollHidden}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className={styles.formGrid}>
          <div className={styles.formFull}>
            <Label htmlFor={`${idPrefix}-reason`}>{reasonLabel}</Label>
            <Textarea
              id={`${idPrefix}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              maxLength={500}
            />
          </div>
        </div>
        {error || serverError ? (
          <div className={styles.errorBlock} role="alert">
            <p className={styles.errorText}>{error ?? serverError}</p>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {keepLabel}
          </Button>
          <Button
            variant="destructive"
            className={styles.btnRed}
            onClick={() => {
              setError(null);
              onSubmit(reason.trim() ? reason.trim() : undefined);
            }}
            disabled={busy}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {busy ? "Cancelling…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
