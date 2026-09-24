"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  terms: { id: string; termNumber: number }[];
  termId: string;
  onTermChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
  canConfirm: boolean;
}

export function CoordinatorReferralsCreateDialog({
  target,
  terms,
  termId,
  onTermChange,
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
          <div className={styles.formField}>
            <Label className={styles.formLabel} htmlFor="coord-term">
              Term
            </Label>
            <select
              id="coord-term"
              value={termId}
              onChange={(e) => onTermChange(e.target.value)}
              className={styles.select}
              disabled={pending}
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  Term {t.termNumber}
                </option>
              ))}
            </select>
          </div>
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
