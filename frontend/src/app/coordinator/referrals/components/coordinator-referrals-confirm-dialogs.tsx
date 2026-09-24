"use client";

import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AdmCaseRow } from "../../components/coordinator-data";
import styles from "./coordinator-referrals-confirm-dialogs.module.css";

interface ConfirmDialogProps {
  target: AdmCaseRow | null;
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
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Advance to parent meeting?</AlertDialogTitle>
          <AlertDialogDescription>
            {target ? (
              <>
                {target.student} will move from consultation to the parent
                meeting stage. Record whether the parents attended next.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={(e) => {
              // Hold the dialog open for the flight: success closes it via
              // the hook clearing the target; failure leaves it open with
              // Cancel re-enabled so the user can retry.
              e.preventDefault();
              onConfirm();
            }}
          >
            {pending ? (
              <Loader2 className={styles.spin} aria-hidden="true" />
            ) : null}
            {pending ? "Advancing…" : "Advance"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CoordinatorReferralsForwardDialog({
  target,
  pending,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Endorse to Principal?</AlertDialogTitle>
          <AlertDialogDescription>
            {target ? (
              <>
                {target.student}&apos;s certification will be locked and sent
                to the Principal for final signature. You can no longer edit the
                recommendation until it is returned.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {pending ? (
              <Loader2 className={styles.spin} aria-hidden="true" />
            ) : null}
            {pending ? "Endorsing…" : "Endorse"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
