"use client";
import { ClipboardCheck, Info, Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import type { Submission } from "./use-principal-schedule-section";
export function ReviewPanel({
  submission,
  submittedCount,
  statusMeta,
  note,
  onOpenReview,
  onReview,
  rejecting,
  approving,
  reviewPending,
}: {
  submission: Submission;
  submittedCount: number;
  statusMeta: { title: string; message: string; from: string; to: string; chip: string; icon: string; Icon: React.ComponentType<{ size?: number | string; className?: string }> };
  note: string;
  onOpenReview: () => void;
  onReview: (decision: "approve" | "reject") => void;
  rejecting: boolean;
  approving: boolean;
  reviewPending: boolean;
}) {
  const StatusIcon = statusMeta.Icon;
  return (
    <div className="flex w-full flex-col gap-4">
      <div
        className={assign.card}
        aria-label={`Section adviser for ${submission.name}`}
      >
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
            aria-hidden="true"
          >
            <UserRound size={20} className="text-primary" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold">Adviser</h3>
            <p
              className="truncate text-xs text-muted-foreground"
              title={submission.adviser?.fullName ?? "No adviser assigned"}
            >
              {submission.adviser ? submission.adviser.fullName : "No adviser assigned"}
            </p>
          </div>
        </div>
      </div>
      <div
        className={assign.card}
        role="status"
        aria-label={`Schedule status: ${statusMeta.title} — ${statusMeta.message}`}
        style={{
          borderColor: `color-mix(in oklch, ${statusMeta.from} 45%, transparent)`,
          background: `linear-gradient(135deg, color-mix(in oklch, ${statusMeta.from} 26%, var(--card)), color-mix(in oklch, ${statusMeta.to} 18%, var(--card)))`,
        }}
      >
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex items-center gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${statusMeta.chip}`}
            aria-hidden="true"
          >
            <StatusIcon size={20} className={statusMeta.icon} />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold">{statusMeta.title}</h3>
            <p className="text-xs text-muted-foreground">{statusMeta.message}</p>
          </div>
        </div>
      </div>
      {submittedCount > 0 ? (
        <div className={assign.card} aria-label={`Review schedule for ${submission.name}`}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
              aria-hidden="true"
            >
              <ClipboardCheck size={20} className="text-primary" />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold">Review</h3>
              <p className="text-xs text-muted-foreground">
                Approve or send back with a note.
              </p>
            </div>
          </div>
          <div className="relative flex flex-col gap-2">
            <button
              type="button"
              onClick={onOpenReview}
              aria-haspopup="dialog"
              className={`flex min-h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors hover:border-primary ${note ? "text-foreground" : "text-muted-foreground"}`}
            >
              <span className="truncate">
                {note ? note : "Revision note (required to send back)…"}
              </span>
            </button>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => onReview("reject")}
                disabled={reviewPending}
                aria-busy={rejecting || undefined}
                className="flex-1"
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
                className="flex-1"
              >
                {approving ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                ) : null}
                <span aria-live="polite">Approve</span>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <div className={assign.card} aria-label="Slot status legend">
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
            aria-hidden="true"
          >
            <Info size={20} className="text-primary" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold">Legend</h3>
            <p className="text-xs text-muted-foreground">
              What each slot dot means.
            </p>
          </div>
        </div>
        <div className="relative flex flex-col gap-1.5 text-sm">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
            Draft — not yet submitted
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden />
            Submitted — awaiting your review
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" aria-hidden />
            Approved — official
          </span>
        </div>
      </div>
    </div>
  );
}
