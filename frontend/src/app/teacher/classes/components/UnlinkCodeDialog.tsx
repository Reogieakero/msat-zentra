"use client";

import * as React from "react";
import { Loader2, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import type { LinkedName } from "./timetable-sidebar";

/**
 * Legacy bordered amber chip still consumed by the grading/attendance desks.
 * New desks should use the shared `<Pill tone="amber" label=…>` instead.
 */
export function AmberRectPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[12px] font-medium leading-4 text-amber-700 dark:text-amber-400">
      {children}
    </span>
  );
}

export function UnlinkCodeDialog({
  linked,
  pending,
  onClose,
  onConfirm,
}: {
  linked: LinkedName;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  React.useEffect(() => {
    if (pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[color-mix(in_oklch,#000_55%,transparent)] p-4 dark:bg-[color-mix(in_oklch,#000_72%,transparent)]"
      onMouseDown={(e) => {
        if (!pending && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Unlink ${linked.code ?? linked.name} from your login`}
        className="w-full max-w-sm"
      >
        <KanbanBoard
          title="Unlink code"
          icon={
            <span className="text-amber-500" aria-hidden>
              <UserRound size={14} />
            </span>
          }
          actions={
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
          className="bg-card shadow-xl"
        >
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <Pill tone="amber" label="Linked teacher">
              {linked.name}
            </Pill>
            {linked.code ? (
              <Pill tone="amber" label="Teacher code">
                {linked.code}
              </Pill>
            ) : null}
          </div>
          <p className="px-1 text-xs leading-5 text-muted-foreground">
            This unlinks your code from your login — your classes, grading, and
            attendance will clear together. You can link a code again any time
            from this page.
          </p>
          <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
            <Button
              variant="destructive"
              size="sm"
              onClick={onClose}
              disabled={pending}
              className="h-6 px-2 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onConfirm}
              disabled={pending}
              aria-busy={pending || undefined}
              className="h-6 rounded-lg bg-black px-3 text-xs text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              {pending ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Unlinking…</span>
                </>
              ) : (
                "Unlink code"
              )}
            </Button>
          </div>
        </KanbanBoard>
      </div>
    </div>
  );
}
