"use client";

import * as React from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import type { AdmCaseRow } from "@/services/coordinator/coordinator.types";
import { eligibilityLabel } from "@/services/coordinator/labels";

/* Same rectangle pill metric as the board rows. */
const PILL_BASE =
  "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap";
const PILL_SECONDARY = "border-border bg-secondary text-secondary-foreground";

/**
 * Kanban-style confirmation overlay for "Mark as completed" (same pattern
 * as the other desk confirmations). Confirming closes the overlay at once
 * and the shared Dock in the bottom-right reports the request until it
 * settles.
 */
export function CoordinatorEnrolledCompleteConfirm({
  row,
  pending,
  onConfirm,
  onClose,
}: {
  row: AdmCaseRow;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Mark as completed?"
    >
      <button
        type="button"
        aria-label="Cancel"
        onClick={onClose}
        disabled={pending}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-md">
        <KanbanBoard
          className="bg-card shadow-2xl"
          title="Mark as completed?"
          icon={
            <span className="text-emerald-600 dark:text-emerald-400" aria-hidden>
              <CheckCircle2 size={14} />
            </span>
          }
          actions={
            /* 24px close X — same as the other overlay kanbans. */
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              aria-label="Close dialog"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <X size={14} aria-hidden="true" />
            </button>
          }
          description={`${row.student} will move to the Complete column. Device return can then be recorded on the Devices page.`}
          footer={
            /* 24px action button — no Cancel; confirming closes at once. */
            <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
              <Button
                type="button"
                size="sm"
                className="h-6 px-3 text-xs"
                onClick={onConfirm}
                disabled={pending}
                aria-busy={pending || undefined}
                autoFocus
              >
                {pending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : null}
                {pending ? "Marking…" : "Mark completed"}
              </Button>
            </div>
          }
        >
          <div className="flex items-center gap-2 px-1">
            <StudentMascot name={row.student} seed={row.lrn} size={32} />
            <span className="min-w-0 truncate text-sm font-semibold text-primary">
              {row.student}
            </span>
            <span className={`${PILL_BASE} ${PILL_SECONDARY} tabular-nums`} title={row.lrn}>
              {row.lrn}
            </span>
            <span className={`${PILL_BASE} ${PILL_SECONDARY}`}>{row.grade || "—"}</span>
            <span className={`${PILL_BASE} ${PILL_SECONDARY}`}>
              {eligibilityLabel(row.eligibilityStatus)}
            </span>
          </div>
          <p className="px-1 text-xs text-muted-foreground">
            The case moves to the Complete column while the request settles.
          </p>
        </KanbanBoard>
      </div>
    </div>
  );
}
