"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { Textarea } from "@/components/ui/textarea";
import formStyles from "@/app/principal/academics/assign/components/form.module.css";
export function ReviewDialog({
  open,
  onClose,
  sectionName,
  sectionId,
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
    <CardModal
      open={open}
      onClose={onClose}
      size="sm"
      title={`Review schedule for ${sectionName}`}
      description="Approve the timetable or send it back to the master teacher with a revision note."
      dismissable={!reviewPending}
      watchKey={sectionId}
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
      <div className={formStyles.dialogFooter}>
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
    </CardModal>
  );
}
