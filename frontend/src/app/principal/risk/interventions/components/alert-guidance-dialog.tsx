"use client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CardModal } from "@/components/ui/CardModal";
import { Spinner } from "@/components/ui/spinner";
import formStyles from "@/app/principal/academics/assign/components/form.module.css";
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
    <CardModal
      open={target !== null}
      onClose={onClose}
      size="sm"
      title="Alert guidance"
      description={
        target
          ? `${target.studentName} (${target.lrn}) has no intervention action yet. This notifies every active guidance counselor.`
          : "Notify every active guidance counselor."
      }
      dismissable={!pending}
      watchKey={target?.studentId}
    >
      <Textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Optional note for guidance…"
        rows={3}
        maxLength={500}
        aria-label="Optional note for guidance"
      />
      <div className={formStyles.dialogFooter}>
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
    </CardModal>
  );
}
