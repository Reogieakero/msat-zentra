"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import type { AdmCaseRow } from "@/services/coordinator/coordinator.types";
import styles from "./coordinator-referrals-create-dialog.module.css";

interface CoordinatorReferralsCreateDialogProps {
  target: AdmCaseRow | null;

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
    <CardModal
      open={target !== null}
      onClose={onClose}
      dismissable={!pending}
      title="Create learner profile"
      description={
        target ? (
          <>
            For {target.student} ({target.lrn}). The case starts at the
            parent-meeting stage.
          </>
        ) : undefined
      }
      size="sm"
    >
      <div className={styles.formGrid}>
        <p className={styles.scopeNote}>
          Filed under <strong>{scopeLabel}</strong> — the session&apos;s active
          scope. Change it from the top-bar badge.
        </p>
      </div>
      <div className={styles.actions}>
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
      </div>
    </CardModal>
  );
}
