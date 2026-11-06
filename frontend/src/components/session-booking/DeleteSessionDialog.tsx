"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
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
  serverError?: string | null;
}

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

  const openKey = open ? "open" : null;
  const [prevOpenKey, setPrevOpenKey] = React.useState<string | null>(null);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    setError(null);
  }

  if (!open) return null;

  return (
    <KanbanOverlay
      open
      onClose={() => {
        if (busy) return;
        onClose();
        setError(null);
      }}
      dismissable={!busy}
      busy={busy}
      width="md"
      title={title}
      description={description}
      footer={
        <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {keepLabel}
          </Button>
          <Button
            variant="destructive"
            className={styles.btnRed}
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {busy ? "Deleting…" : submitLabel}
          </Button>
        </div>
      }
    >
      {error || serverError ? (
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>{error ?? serverError}</p>
        </div>
      ) : null}
    </KanbanOverlay>
  );
}
