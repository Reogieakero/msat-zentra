"use client";

import { UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  KanbanOverlay,
  KanbanPill,
} from "@/components/ui/kanban-overlay";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import type { AdmCaseRow } from "@/services/coordinator/coordinator.types";
import styles from "./coordinator-referrals-create-dialog.module.css";

interface CoordinatorReferralsCreateDialogProps {
  target: AdmCaseRow | null;

  scopeLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Kanban-style "Create learner profile" overlay. Confirming closes the
 * overlay at once — the shared Dock in the bottom-right reports the request
 * until it settles.
 */
export function CoordinatorReferralsCreateDialog({
  target,
  scopeLabel,
  onClose,
  onConfirm,
}: CoordinatorReferralsCreateDialogProps) {
  return (
    <KanbanOverlay
      open={target !== null}
      onClose={onClose}
      title="Create learner profile"
      icon={
        <span className="text-primary" aria-hidden>
          <UserRoundPlus size={14} />
        </span>
      }
      description={
        target
          ? `The case for ${target.student} starts at the parent-meeting stage.`
          : undefined
      }
      footer={
        <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
          <Button
            type="button"
            size="sm"
            className="h-6 px-3 text-xs"
            onClick={onConfirm}
            autoFocus
          >
            Create profile
          </Button>
        </div>
      }
    >
      {target ? (
        <>
          <div className="flex items-center gap-2 px-1">
            <StudentMascot
              name={target.student}
              seed={target.lrn || target.student}
              size={32}
            />
            <KanbanPill tone="accent" title={target.student}>
              {target.student}
            </KanbanPill>
            {target.lrn ? (
              <KanbanPill className="tabular-nums" title={target.lrn}>
                {target.lrn}
              </KanbanPill>
            ) : null}
            {target.grade ? <KanbanPill>{target.grade}</KanbanPill> : null}
          </div>
          <div className={styles.formGrid}>
            <p className={styles.scopeNote}>
              Filed under <strong>{scopeLabel}</strong> — applied automatically.
            </p>
          </div>
        </>
      ) : null}
    </KanbanOverlay>
  );
}
