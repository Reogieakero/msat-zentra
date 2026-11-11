"use client";

import * as React from "react";
import { ArchiveRestore, Loader2, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "@/lib/api/live";
import { anecdotalCategoryBadgeVariant } from "@/lib/labels/anecdotal";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { humanizeCategory } from "@/components/anecdotal/anecdotal-record-kanban-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
import {
  fetchDeletedRecords,
  restoreAnecdotalRecord,
  type MyAnecdotalRecord,
} from "@/components/ocform01/folders";

function recordDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/**
 * Archive records overlay for the teacher anecdotal desk. Shared by the
 * record board (toolbar button) and the empty board, so a teacher can restore
 * removed records even before filing anything.
 *
 * Records are ticked and restored in one batch — per-row Restore stays for the
 * single-record case.
 */
export function AnecdotalArchiveDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const dock = useDock();
  const [restoringIds, setRestoringIds] = React.useState<Set<string>>(new Set());
  /** Ticked archived records (record id keys). */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const restoreDockTaskRef = React.useRef<string | null>(null);

  const deletedQuery = useLiveQuery<MyAnecdotalRecord[]>({
    queryKey: ["anecdotal-deleted"],
    queryFn: fetchDeletedRecords,
    enabled: open,
    staleTime: 15_000,
  });
  const deletedRecords = deletedQuery.data ?? [];

  function refreshRecords() {
    void queryClient.invalidateQueries({ queryKey: ["anecdotal-mine"] });
    void queryClient.invalidateQueries({ queryKey: ["anecdotal-deleted"] });
  }

  // Keep ticks honest when the list refetches (restored rows leave the board).
  React.useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(deletedRecords.map((r) => r.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [deletedRecords]);

  const selectedRecords = deletedRecords.filter((r) => selected.has(r.id));
  const allSelected =
    deletedRecords.length > 0 && selectedRecords.length === deletedRecords.length;

  function toggleSelected(recordId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(deletedRecords.map((r) => r.id)));
  }

  async function handleRestore(entries: MyAnecdotalRecord[]) {
    const targets = entries.filter((entry) => !restoringIds.has(entry.id));
    if (targets.length === 0) return;
    const multi = targets.length > 1;
    setRestoringIds(new Set(targets.map((entry) => entry.id)));
    // Close the overlay as soon as the teacher confirms — the rows return to
    // the desk once the requests land, and the shared dock tracks the task.
    onClose();
    setSelected(new Set());
    restoreDockTaskRef.current = dock.startTask({
      kind: "generic",
      title: multi ? `Restoring ${targets.length} records` : "Restoring record",
      description: multi
        ? "Bringing the archived GCForm-01 records back to your desk."
        : `${targets[0].studentName} · ${humanizeCategory(targets[0].category)}`,
    });
    let restored = 0;
    let failed = 0;
    for (const entry of targets) {
      try {
        await restoreAnecdotalRecord(entry.id);
        restored += 1;
      } catch {
        failed += 1;
      }
    }
    refreshRecords();
    if (restoreDockTaskRef.current) {
      if (failed === 0) {
        dock.completeTask(
          restoreDockTaskRef.current,
          multi
            ? `${restored} records restored to your anecdotal desk.`
            : "Record restored to your anecdotal desk.",
        );
      } else if (restored === 0) {
        dock.failTask(restoreDockTaskRef.current, "Could not restore records.");
      } else {
        dock.completeTask(
          restoreDockTaskRef.current,
          `${restored} restored, ${failed} could not be restored.`,
        );
      }
      restoreDockTaskRef.current = null;
    }
    if (failed === 0) {
      toast.success({
        title: multi ? `${restored} records restored` : "Record restored",
        description: "Back on your anecdotal desk.",
      });
    } else if (restored === 0) {
      toast.error({
        title: "Could not restore record",
        description: "Check your connection and try again.",
      });
    } else {
      toast.error({
        title: `${restored} restored, ${failed} failed`,
        description: "Check your connection and restore the remaining records again.",
      });
    }
    setRestoringIds(new Set());
  }

  const busy = restoringIds.size > 0;

  return (
    <KanbanOverlay
      open={open}
      onClose={onClose}
      width="sm"
      title="Archive records"
      icon={
        <span className="text-primary" aria-hidden>
          <ArchiveRestore size={14} />
        </span>
      }
      description="Records you removed from this desk. Restoring brings the full GCForm-01 back, including its follow-ups."
      footer={
        deletedRecords.length > 0 ? (
          <div className="flex w-full items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {selectedRecords.length > 0
                ? `${selectedRecords.length} selected`
                : `${deletedRecords.length} archived`}
            </span>
            <Button
              type="button"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              disabled={selectedRecords.length === 0 || busy}
              onClick={() => void handleRestore(selectedRecords)}
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <RotateCcw size={14} aria-hidden />
              )}
              Restore selected{selectedRecords.length > 0 ? ` (${selectedRecords.length})` : ""}
            </Button>
          </div>
        ) : null
      }
    >
      <div className="flex min-w-0 flex-col gap-2 px-1">
        {deletedQuery.isPending ? (
          <p className="text-xs text-muted-foreground">Loading archived records…</p>
        ) : deletedRecords.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No archived records. Deleting a record from its preview keeps it here
            for restoring.
          </p>
        ) : (
          <>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-2.5 py-1.5 text-xs text-muted-foreground">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                aria-label="Select all archived records"
              />
              Select all ({deletedRecords.length})
            </label>
            {deletedRecords.map((entry) => {
              const checked = selected.has(entry.id);
              return (
                <div
                  key={entry.id}
                  className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleSelected(entry.id)}
                    aria-label={`Select ${entry.studentName}'s record for restoring`}
                  />
                  <StudentMascot
                    name={entry.studentName}
                    seed={entry.lrn}
                    character={entry.mascot ?? undefined}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-primary">
                      {entry.studentName}
                    </span>
                    <span className="mt-1 flex max-w-full flex-wrap items-center gap-1">
                      <Pill tone="neutral" label="LRN">
                        {entry.lrn}
                      </Pill>
                      <Pill
                        tone={anecdotalCategoryBadgeVariant(entry.category) ?? "neutral"}
                        label="Category"
                      >
                        {humanizeCategory(entry.category)}
                      </Pill>
                      <Pill tone="neutral" label="Archived">
                        {recordDate(entry.deletedAt ?? entry.observationDatetime)}
                      </Pill>
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 shrink-0 px-2 text-xs"
                    onClick={() => void handleRestore([entry])}
                    disabled={busy}
                  >
                    {restoringIds.has(entry.id) ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                    ) : (
                      <RotateCcw size={14} aria-hidden />
                    )}
                    Restore
                  </Button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </KanbanOverlay>
  );
}
