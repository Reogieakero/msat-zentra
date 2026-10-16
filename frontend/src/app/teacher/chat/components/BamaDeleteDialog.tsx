"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";
import type { BamaConversation } from "./bama-conversations";

interface BamaDeleteDialogProps {
  target: BamaConversation | null;
  onClose: () => void;
  onConfirm: () => void;
}

// Delete confirmation as a kanban column (not the shared card-modal chrome):
// muted column, bordered head, white message card, red 24px actions.
export function BamaDeleteDialog({ target, onClose, onConfirm }: BamaDeleteDialogProps) {
  const [mounted, setMounted] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- portal guard for prerender */
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  React.useEffect(() => {
    if (!target) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [target]);

  if (!target || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete this chat?"
        tabIndex={-1}
        className="flex w-full max-w-sm min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted p-2.5 shadow-xl [font-family:var(--font-inter)] outline-none dark:bg-muted"
      >
        <div className="-mx-2.5 flex items-center justify-between gap-2 border-b border-border px-3.5 pb-2">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
            <Trash2 size={14} aria-hidden className="text-red-500" />
            <span className="truncate">Delete this chat?</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border border-transparent bg-transparent text-muted-foreground transition-colors outline-none hover:border-border hover:bg-white hover:shadow-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 dark:hover:bg-card"
          >
            <X size={13} aria-hidden />
          </button>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm dark:bg-card">
          <p className="m-0 text-xs leading-snug text-muted-foreground">
            <span className="font-semibold text-foreground">“{target.title}”</span> will be
            permanently removed. This cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-6 rounded-md bg-[#dc2626] px-3 text-[11px] font-semibold text-white transition-colors outline-none hover:bg-[#b91c1c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-6 rounded-md bg-[#dc2626] px-3 text-[11px] font-semibold text-white transition-colors outline-none hover:bg-[#b91c1c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
