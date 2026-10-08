"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
export function SaveAttendanceDialog({
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
  breakdown: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <CardModal
      open
      onClose={() => {
        if (!saving) onClose();
      }}
      dismissable={!saving}
      size="sm"
      title="Save attendances?"
      description={
        <>
          Submits {count} student{count === 1 ? "" : "s"}
          {breakdown ? ` — ${breakdown}` : ""} for this sheet.
        </>
      }
    >
      {saveError ? (
        <p role="alert" className="text-sm text-destructive">
          {saveError}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="destructive" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={saving} aria-busy={saving || undefined}>
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
    </CardModal>
  );
}
