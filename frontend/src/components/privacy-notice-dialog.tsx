"use client";

import * as React from "react";
import { ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";

interface PrivacyNoticeDialogProps {
  open: boolean;
  onClose: () => void;
  studentName?: string;

  reason?: "finished" | "endorsed" | "principal";
}

/**
 * Overlay kanban notice — same shell as the other overlay kanbans (dark
 * backdrop, centered board, 24px footer button). Read-only: it explains why
 * a finished/endorsed report stays hidden and only offers to dismiss.
 */
export function PrivacyNoticeDialog({
  open,
  onClose,
  studentName,
  reason = "finished",
}: PrivacyNoticeDialogProps) {
  const endorsed = reason === "endorsed";
  const principal = reason === "principal";
  const title = endorsed ? "With the ADM coordinator" : "Kept private";
  const notice = endorsed ? (
    <>
      {studentName
        ? `The full report for ${studentName} can't be opened because this case was endorsed to the ADM coordinator. `
        : "This full report can't be opened because the case was endorsed to the ADM coordinator. "}
      It moved with the case and is no longer viewable on this
      desk. The summary shown on this page is all that remains
      visible.
    </>
  ) : principal ? (
    <>
      {studentName
        ? `The full report for ${studentName} can't be opened. `
        : "This full report can't be opened. "}
      It stays hidden to protect the student&apos;s privacy — the
      principal has nothing to do with these cases unless an open
      case is forwarded to the principal. The summary shown on this
      page is all that remains visible.
    </>
  ) : (
    <>
      {studentName
        ? `The full report for ${studentName} can't be opened because this case is finished. `
        : "This full report can't be opened because the case is finished. "}
      It stays hidden to protect the student&apos;s privacy. The summary
      shown on this page is all that remains visible.
    </>
  );

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    /* `whitespace-normal` — callers mount this inside nowrap row cells
       (e.g. `.cellActions`), and white-space inherits. */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 whitespace-normal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-md">
        <KanbanBoard
          className="bg-card shadow-2xl"
          title={title}
          icon={
            <span className="text-primary" aria-hidden>
              <ShieldCheck size={14} />
            </span>
          }
          actions={
            /* 24px close X — same as the other overlay kanbans. */
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X size={14} aria-hidden="true" />
            </button>
          }
          description={notice}
          footer={
            /* 24px action button — same metric as the kanban boards. */
            <div className="flex justify-end gap-1.5 px-1 pb-1">
              <Button
                type="button"
                size="sm"
                className="h-6 px-3 text-xs"
                onClick={onClose}
                autoFocus
              >
                Understood
              </Button>
            </div>
          }
        >
          {null}
        </KanbanBoard>
      </div>
    </div>
  );
}
