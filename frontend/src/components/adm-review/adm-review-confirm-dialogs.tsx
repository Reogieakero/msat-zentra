"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import styles from "./adm-review-dialog.module.css";
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
  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen && !acting && !booking) onCancel();
      }}
    >
      <DialogContent
        className={styles.dialogScrollHidden}
        aria-busy={acting || booking || undefined}
      >
        <DialogHeader>
          <DialogTitle>
            {confirmFor === "book"
              ? "Book this session?"
              : confirmFor === "reject"
                ? "Reject this case?"
                : "Create referral?"}
          </DialogTitle>
          <DialogDescription>
            {confirmFor === "book" ? (
              <>A {sessionNoun} session will be scheduled for {student}. The case stays pending until you decide.</>
            ) : confirmFor === "reject" ? (
              <>{student}&rsquo;s case will be closed without ADM follow-through — the coordinator never receives it. This can&apos;t be undone.</>
            ) : (
              <>Open the referral form with your recommendation carried over.{createConfirmHint ? ` ${createConfirmHint}` : ""}</>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="destructive"
            className={styles.btnRed}
            onClick={onCancel}
            disabled={acting || booking}
          >
            Cancel
          </Button>
          {confirmFor === "book" ? (
            <Button
              onClick={onBook}
              disabled={booking}
              aria-busy={booking || undefined}
            >
              {booking ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {booking ? "Booking…" : "Yes, book"}
            </Button>
          ) : confirmFor === "reject" ? (
            <Button
              variant="destructive"
              className={styles.btnRed}
              onClick={onReject}
              disabled={acting}
              aria-busy={acting || undefined}
            >
              {acting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {acting ? "Rejecting…" : "Yes, reject"}
            </Button>
          ) : (
            <Button onClick={onCreate}>
              Continue
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className={styles.dialogScrollHidden}>
        <DialogHeader>
          <DialogTitle>Finish the upcoming session first</DialogTitle>
          <DialogDescription>
            {student}&rsquo;s referral still has an upcoming {sessionNoun} session
            (or follow-up) to be done. Create referral cannot be bypassed —
            finish or cancel that session first, then come back to create
            the referral.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
