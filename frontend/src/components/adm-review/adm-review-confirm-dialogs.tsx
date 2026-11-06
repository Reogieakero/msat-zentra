"use client";
import * as React from "react";
import { CalendarPlus, Clock, Loader2, Send, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import styles from "./adm-review-dialog.module.css";

/* Kanban-style overlay for the review's confirmations — dark blurred
   backdrop, a KanbanBoard card, and 24px footer buttons, matching the
   other desk confirmations (e.g. save attendance). Sits above the review
   overlay (z-60). */
function ConfirmOverlay({
  label,
  locked,
  onClose,
  children,
}: {
  label: string;
  locked: boolean;
  onClose: () => void;
  children: React.ReactNode;
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
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label={label}
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

export function AdmReviewConfirmDialogs({
  confirmFor,
  student,
  sessionNoun,
  createConfirmHint,
  acting,
  booking,
  onCancel,
  onBook,
  onReject,
  onCreate,
}: {
  confirmFor: null | "book" | "reject" | "create";
  student: string;
  sessionNoun: "clinic" | "counseling";
  createConfirmHint?: string;
  acting: boolean;
  booking: boolean;
  onCancel: () => void;
  onBook: () => void;
  onReject: () => void;
  onCreate: () => void;
}) {
  if (!confirmFor) return null;
  const locked = acting || booking;
  const title =
    confirmFor === "book"
      ? "Book this session?"
      : confirmFor === "reject"
        ? "Reject this case?"
        : "Create referral?";
  const icon =
    confirmFor === "book" ? (
      <span className="text-primary" aria-hidden>
        <CalendarPlus size={14} />
      </span>
    ) : confirmFor === "reject" ? (
      <span className="text-red-500" aria-hidden>
        <XCircle size={14} />
      </span>
    ) : (
      <span className="text-primary" aria-hidden>
        <Send size={14} />
      </span>
    );
  const description =
    confirmFor === "book" ? (
      <>A {sessionNoun} session will be scheduled for {student}. The case stays pending until you decide.</>
    ) : confirmFor === "reject" ? (
      <>{student}&rsquo;s case will be closed without ADM follow-through — the coordinator never receives it. This can&apos;t be undone.</>
    ) : (
      <>Open the referral form with your recommendation carried over.{createConfirmHint ? ` ${createConfirmHint}` : ""}</>
    );
  return (
    <ConfirmOverlay label={title} locked={locked} onClose={onCancel}>
      <KanbanBoard
        className="bg-card shadow-2xl"
        title={title}
        icon={icon}
        actions={
          /* 24px close X — same as the other overlay kanbans. */
          <button
            type="button"
            onClick={onCancel}
            disabled={locked}
            autoFocus
            aria-label="Close dialog"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <X size={14} aria-hidden="true" />
          </button>
        }
        description={description}
        footer={
          /* 24px action buttons — same metric as the kanban boards. */
          <div className="flex flex-wrap items-center justify-end gap-1.5 px-1 pb-1">
            {confirmFor === "book" ? (
              <Button
                type="button"
                size="sm"
                className="h-6 px-3 text-xs"
                onClick={onBook}
                disabled={booking}
                aria-busy={booking || undefined}
              >
                {booking ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {booking ? "Booking…" : "Yes, book"}
              </Button>
            ) : confirmFor === "reject" ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className={`h-6 px-3 text-xs ${styles.btnRed}`}
                onClick={onReject}
                disabled={acting}
                aria-busy={acting || undefined}
              >
                {acting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {acting ? "Rejecting…" : "Yes, reject"}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="h-6 px-3 text-xs"
                onClick={onCreate}
              >
                Continue
              </Button>
            )}
          </div>
        }
      >
        {null}
      </KanbanBoard>
    </ConfirmOverlay>
  );
}

export function AdmReviewBlockedDialog({
  open,
  student,
  sessionNoun,
  onClose,
}: {
  open: boolean;
  student: string;
  sessionNoun: "clinic" | "counseling";
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <ConfirmOverlay
      label="Finish the upcoming session first"
      locked={false}
      onClose={onClose}
    >
      <KanbanBoard
        className="bg-card shadow-2xl"
        title="Finish the upcoming session first"
        icon={
          <span className="text-amber-500" aria-hidden>
            <Clock size={14} />
          </span>
        }
        actions={
          /* 24px close X — same as the other overlay kanbans. */
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={14} aria-hidden="true" />
          </button>
        }
        description={
          <>
            {student}&rsquo;s referral still has an upcoming {sessionNoun} session
            (or follow-up) to be done. Create referral cannot be bypassed —
            finish or cancel that session first, then come back to create
            the referral.
          </>
        }
        footer={
          /* 24px action button — same metric as the kanban boards. */
          <div className="flex flex-wrap items-center justify-end gap-1.5 px-1 pb-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-3 text-xs"
              onClick={onClose}
              autoFocus
            >
              Got it
            </Button>
          </div>
        }
      >
        {null}
      </KanbanBoard>
    </ConfirmOverlay>
  );
}
