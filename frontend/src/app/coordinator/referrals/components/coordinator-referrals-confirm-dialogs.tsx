"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import type { AdmCaseRow } from "../../components/coordinator-data";
import styles from "./coordinator-referrals-confirm-dialogs.module.css";

interface ConfirmDialogProps {
  // Minimal shape — the queue passes full rows, the case file page passes
  // just the student name. Both dialogs only read `student`.
  target: Pick<AdmCaseRow, "student"> | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CoordinatorReferralsAdvanceDialog({
  target,
  pending,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <CardModal
      open={target !== null}
      onClose={onClose}
      dismissable={!pending}
      title="Advance to parent meeting?"
      description={
        target ? (
          <>
            {target.student} will move from consultation to the parent
            meeting stage. Record whether the parents attended next.
          </>
        ) : undefined
      }
      size="sm"
    >
      <div className={styles.actions}>
        <Button variant="outline" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={pending}
          aria-busy={pending || undefined}
          onClick={() => {
            // Hold the dialog open for the flight: success closes it via
            // the hook clearing the target; failure leaves it open with
            // Cancel re-enabled so the user can retry.
            onConfirm();
          }}
        >
          {pending ? (
            <Loader2 className={styles.spin} aria-hidden="true" />
          ) : null}
          {pending ? "Advancing…" : "Advance"}
        </Button>
      </div>
    </CardModal>
  );
}

export function CoordinatorReferralsForwardDialog({
  target,
  pending,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <CardModal
      open={target !== null}
      onClose={onClose}
      dismissable={!pending}
      title="Endorse to Principal?"
      description={
        target ? (
          <>
            {target.student}&apos;s certification will be locked and sent
            to the Principal for final signature. You can no longer edit the
            recommendation until it is returned.
          </>
        ) : undefined
      }
      size="sm"
    >
      <div className={styles.actions}>
        <Button variant="outline" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={pending}
          aria-busy={pending || undefined}
          onClick={() => {
            onConfirm();
          }}
        >
          {pending ? (
            <Loader2 className={styles.spin} aria-hidden="true" />
          ) : null}
          {pending ? "Endorsing…" : "Endorse"}
        </Button>
      </div>
    </CardModal>
  );
}
