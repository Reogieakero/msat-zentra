"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Textarea } from "@/components/ui/textarea";
export function ReviewDialog({
  open,
  onClose,
  sectionName,
  note,
  onNoteChange,
  formError,
  onReview,
  rejecting,
  approving,
  reviewPending,
}: {
  open: boolean;
  onClose: () => void;
  sectionName: string;
  sectionId: string;
  note: string;
  onNoteChange: (v: string) => void;
  formError: string | null;
  onReview: (decision: "approve" | "reject") => void;
  rejecting: boolean;
  approving: boolean;
  reviewPending: boolean;
}) {
  return (
    <KanbanOverlay
      open={open}
      onClose={onClose}
      width="sm"
      title={`Review schedule for ${sectionName}`}
      description="Approve the timetable or send it back to the master teacher with a revision note."
      dismissable={!reviewPending}
      busy={reviewPending}
      footer={
        <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
          <Button
            variant="destructive"
            onClick={() => onReview("reject")}
            disabled={reviewPending}
            aria-busy={rejecting || undefined}
          >
            {rejecting ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : null}
            <span aria-live="polite">Reject</span>
          </Button>
          <Button
            onClick={() => onReview("approve")}
            disabled={reviewPending}
            aria-busy={approving || undefined}
          >
            {approving ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : null}
            <span aria-live="polite">Approve</span>
          </Button>
        </div>
      }
    >
      <Textarea
        autoFocus
        rows={4}
        placeholder="Revision note (required to send back)…"
        value={note}
        onChange={(e) => {
          onNoteChange(e.target.value);
        }}
        aria-label={`Revision note for ${sectionName}`}
      />
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
    </KanbanOverlay>
  );
}
