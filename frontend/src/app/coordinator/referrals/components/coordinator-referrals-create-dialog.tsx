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
import type { AdmCaseRow } from "../../components/coordinator-data";
import styles from "./coordinator-referrals-create-dialog.module.css";

interface CoordinatorReferralsCreateDialogProps {
  target: AdmCaseRow | null;
  /** Read-only session scope the profile will be filed under. */
  scopeLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
  canConfirm: boolean;
}

export function CoordinatorReferralsCreateDialog({
  target,
  scopeLabel,
  onClose,
  onConfirm,
  pending,
  canConfirm,
}: CoordinatorReferralsCreateDialogProps) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create learner profile</DialogTitle>
          <DialogDescription>
            {target ? (
              <>
                For {target.student} ({target.lrn}). The case starts at the
                parent-meeting stage.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className={styles.formGrid}>
          <p className={styles.scopeNote}>
            Filed under <strong>{scopeLabel}</strong> — the session&apos;s active
            scope. Change it from the top-bar badge.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            className={styles.btnRed}
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            disabled={!canConfirm}
            aria-busy={pending || undefined}
            onClick={onConfirm}
          >
            {pending ? (
              <Loader2 className={styles.spin} aria-hidden="true" />
            ) : null}
            {pending ? "Creating…" : "Create profile"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
