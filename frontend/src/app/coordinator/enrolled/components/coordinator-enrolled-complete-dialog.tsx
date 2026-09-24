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
import styles from "./coordinator-enrolled-complete-dialog.module.css";

interface CoordinatorEnrolledCompleteDialogProps {
  target: AdmCaseRow | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CoordinatorEnrolledCompleteDialog({
  target,
  pending,
  onClose,
  onConfirm,
}: CoordinatorEnrolledCompleteDialogProps) {
  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark as completed?</AlertDialogTitle>
          <AlertDialogDescription>
            {target ? (
              <>
                {target.student} will move from enrollment monitoring to
                completion. Record the device return on the Devices page next.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={onConfirm}>
            {pending ? (
              <Loader2 className={styles.spin} aria-hidden="true" />
            ) : null}
            {pending ? "Marking…" : "Mark completed"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
