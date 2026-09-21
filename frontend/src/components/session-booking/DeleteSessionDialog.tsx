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
import styles from "./BookSessionDialog.module.css";

interface DeleteSessionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  keepLabel?: string;
  submitLabel?: string;
  busy?: boolean;
  /** Save failure from the caller's API call. */
  serverError?: string | null;
}

/**
 * Shared delete-cancelled-session confirm — permanent removal, case stays
 * open. The caller performs the delete.
 */
export function DeleteSessionDialog({
  open,
  onClose,
  onConfirm,
  title = "Delete cancelled session?",
  description = "This permanently removes the cancelled session from the list. The case itself stays open. This cannot be undone.",
  keepLabel = "Keep it",
  submitLabel = "Delete session",
  busy = false,
  serverError = null,
}: DeleteSessionDialogProps) {
  const [error, setError] = React.useState<string | null>(null);

  // Fresh error state every time the modal opens — synced during render,
  // never in an effect.
  const openKey = open ? "open" : null;
  const [prevOpenKey, setPrevOpenKey] = React.useState<string | null>(null);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
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
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {busy ? "Deleting…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
