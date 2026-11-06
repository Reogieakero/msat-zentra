"use client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Spinner } from "@/components/ui/spinner";
import type { RiskSnapshotStudent } from "../types";
export function AlertGuidanceDialog({
  target,
  note,
  onNoteChange,
  pending,
  onClose,
  onSubmit,
}: {
  target: RiskSnapshotStudent | null;
  note: string;
  onNoteChange: (v: string) => void;
  pending: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <KanbanOverlay
      open={target !== null}
      onClose={onClose}
      width="sm"
      title="Alert guidance"
      description={
        target
          ? `${target.studentName} (${target.lrn}) has no intervention action yet. This notifies every active guidance counselor.`
          : "Notify every active guidance counselor."
      }
      dismissable={!pending}
      busy={pending}
      footer={
        <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={pending || !target}
            aria-busy={pending || undefined}
            onClick={onSubmit}
          >
            {pending ? (
              <>
                <Spinner className="size-4" aria-hidden />
                Alerting…
              </>
            ) : (
              "Alert guidance"
            )}
          </Button>
        </div>
      }
    >
      <Textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Optional note for guidance…"
        rows={3}
        maxLength={500}
        aria-label="Optional note for guidance"
      />
    </KanbanOverlay>
  );
}
