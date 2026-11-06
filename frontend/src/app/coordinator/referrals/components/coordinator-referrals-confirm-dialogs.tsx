"use client";

import { BadgeCheck, CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  KanbanOverlay,
  KanbanPill,
} from "@/components/ui/kanban-overlay";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import type { AdmCaseRow } from "@/services/coordinator/coordinator.types";

interface ConfirmDialogProps {
  target: Pick<AdmCaseRow, "student"> | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Forward target — the list passes the full row, the case page only the name. */
type ForwardTarget = Pick<AdmCaseRow, "student"> &
  Partial<Pick<AdmCaseRow, "lrn" | "grade" | "eligibilityStatus">>;

interface ForwardDialogProps {
  target: ForwardTarget | null;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Kanban-style "Advance to parent meeting" overlay (same pattern as the other
 * desk confirmations). Confirming closes the overlay at once — the shared
 * Dock reports the request until it settles.
 */
export function CoordinatorReferralsAdvanceDialog({
  target,
  pending,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <KanbanOverlay
      open={target !== null}
      onClose={onClose}
      dismissable={!pending}
      width="sm"
      title="Advance to parent meeting?"
      icon={
        <span className="text-primary" aria-hidden>
          <CalendarClock size={14} />
        </span>
      }
      description={
        target
          ? `${target.student} will move from consultation to the parent meeting stage. Record whether the parents attended next.`
          : undefined
      }
      footer={
        <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-3 text-xs"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-6 px-3 text-xs"
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={onConfirm}
            autoFocus
          >
            {pending ? (
              <Loader2
                className="animate-spin"
                style={{ width: "0.875rem", height: "0.875rem" }}
                aria-hidden="true"
              />
            ) : null}
            {pending ? "Advancing…" : "Advance"}
          </Button>
        </div>
      }
    >
      {target ? (
        <div className="flex items-center gap-2 px-1">
          <StudentMascot name={target.student} seed={target.student} size={32} />
          <KanbanPill tone="accent" title={target.student}>
            {target.student}
          </KanbanPill>
        </div>
      ) : null}
    </KanbanOverlay>
  );
}

/**
 * Kanban-style "Endorse to Principal" overlay (same pattern as the other
 * desk confirmations). Confirming closes the overlay at once — the shared
 * Dock in the bottom-right reports the request until it settles.
 */
export function CoordinatorReferralsForwardDialog({
  target,
  onClose,
  onConfirm,
}: ForwardDialogProps) {
  return (
    <KanbanOverlay
      open={target !== null}
      onClose={onClose}
      title="Endorse to Principal?"
      icon={
        <span className="text-primary" aria-hidden>
          <BadgeCheck size={14} />
        </span>
      }
      description={
        target
          ? `${target.student}'s certification will be locked and sent to the Principal for final signature.`
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
            Endorse
          </Button>
        </div>
      }
    >
      {target ? (
        <>
          <div className="flex items-center gap-2 px-1">
            <StudentMascot
              name={target.student}
              seed={target.lrn ?? target.student}
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
          <p className="px-1 text-xs text-muted-foreground">
            You can no longer edit the recommendation until it is returned.
          </p>
        </>
      ) : null}
    </KanbanOverlay>
  );
}
