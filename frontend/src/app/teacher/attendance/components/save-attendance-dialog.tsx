"use client";
import * as React from "react";
import { ListChecks, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";

const PILL_BASE =
  "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium";

const STATUS_PILL: Record<"present" | "absent" | "late" | "excused", string> = {
  present: "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400",
  absent: "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400",
  late: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  excused: "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400",
};

export function SaveAttendanceKanban({
  open,
  saving,
  saveError,
  count,
  breakdown,
  onClose,
  onConfirm,
}: {
  open: boolean;
  saving: boolean;
  saveError: string | null;
  count: number;
  breakdown: { status: "present" | "absent" | "late" | "excused"; count: number }[];
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <SaveConfirmOverlay onClose={onClose} locked={saving}>
    <KanbanBoard
      className="bg-card shadow-2xl"
      title="Save attendances?"
      icon={
        <span className="text-amber-500" aria-hidden>
          <ListChecks size={14} />
        </span>
      }
      description={`Submits ${count} student${count === 1 ? "" : "s"} for this sheet.`}
      footer={
        <div className="flex justify-end gap-1.5 px-1 pb-1">
          <Button
            size="sm"
            onClick={onClose}
            disabled={saving}
            autoFocus
            className="h-6 border-transparent bg-red-600 px-3 text-xs text-white hover:bg-red-700 hover:text-white dark:border-transparent dark:bg-red-600 dark:text-white dark:hover:bg-red-700 dark:hover:text-white"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={saving}
            aria-busy={saving || undefined}
            className="h-6 border-input bg-white px-3 text-xs text-black hover:bg-neutral-100 hover:text-black dark:border-transparent dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:hover:text-black"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden />
                <span aria-live="polite">Saving…</span>
              </>
            ) : (
              "Save attendances"
            )}
          </Button>
        </div>
      }
    >
      {breakdown.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 px-1" aria-label="Attendance breakdown">
          {breakdown.map((b) => (
            <span key={b.status} className={`${PILL_BASE} ${STATUS_PILL[b.status]}`}>
              {b.count} {b.status}
            </span>
          ))}
        </div>
      ) : null}
      {saveError ? (
        <p role="alert" className="px-1 text-xs text-red-600 dark:text-red-400">
          {saveError}
        </p>
      ) : (
        <p className="px-1 text-xs text-muted-foreground">
          Review the breakdown above, then confirm to submit.
        </p>
      )}
    </KanbanBoard>
    </SaveConfirmOverlay>
  );
}

function SaveConfirmOverlay({
  children,
  onClose,
  locked,
}: {
  children: React.ReactNode;
  onClose: () => void;
  locked: boolean;
}) {
  React.useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Save attendances?"
    >
      <button
        type="button"
        aria-label="Cancel"
        onClick={() => {
          if (!locked) onClose();
        }}
        disabled={locked}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}
