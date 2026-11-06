"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { useDock } from "@/components/dock/dock-store";
import { markSelfNotified } from "@/lib/realtime/nurseChannel";
import { apiErrorMessage } from "@/lib/api/errors";
import { forwardNurseAdmCase } from "@/services/nurse/referrals.service";
import { applyAdmEndorsedCase } from "@/services/nurse/labels";
import type { NurseQueueRow } from "@/services/nurse/nurse.types";
import { anecdotalCategoryPillClass } from "../../referrals/components/nurse-referrals-format";
import { useNurseMutation } from "./use-nurse-mutation";

/* Same rectangle pill metric as the board rows. */
const PILL_BASE =
  "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap";
const PILL_SECONDARY = "border-border bg-secondary text-secondary-foreground";

/**
 * Kanban-style confirmation for "Endorse & forward" (same overlay pattern
 * as the attendance save confirm). Confirming is optimistic: the overlay
 * closes at once, the row flips to Endorsed on the board and the KPI counts
 * shift in place (no refetch), and the shared Dock in the bottom-right
 * reports the request until it settles.
 */
export function NurseForwardAdmConfirm({
  row,
  onClose,
}: {
  row: NurseQueueRow;
  onClose: () => void;
}) {
  const dock = useDock();
  const sendingRef = React.useRef(false);

  const forwardMutation = useNurseMutation({
    mutationFn: () => forwardNurseAdmCase(row.id),
    successTitle: "Case endorsed",
    successDescription: () =>
      `${row.student}'s case moves to the ADM coordinator for the parent meeting.`,
    errorFallback: "Could not forward this case.",
    dock: false,
    sourceId: row.id,
    scopes: ["overview"],
    // The board patches itself in place (row flips to Endorsed, counts
    // shifted), so the overview never refetches — no refresh badge, no
    // row flicker.
    skipInvalidate: true,
    optimisticUpdate: (old) => applyAdmEndorsedCase(old, row),
  });

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleConfirm() {
    if (sendingRef.current) return;
    sendingRef.current = true;
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "adm-endorse",
        title: "Endorsing ADM case",
        description: `${row.student} → ADM coordinator`,
      });
    } catch {
      taskId = null;
    }
    // Marked before the request: the "You forwarded…" notification can land
    // ahead of the response, and the realtime channel must treat it as ours
    // (no toast, no refresh).
    markSelfNotified(row.id);
    forwardMutation.mutate(undefined, {
      onSuccess: () => {
        if (taskId) dock.completeTask(taskId, `${row.student} → ADM coordinator`);
      },
      onError: (err) => {
        if (taskId) {
          dock.failTask(taskId, apiErrorMessage(err, "Could not forward this case."));
        }
      },
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Endorse & forward?"
    >
      <button
        type="button"
        aria-label="Cancel"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-md">
        <KanbanBoard
          className="bg-card shadow-2xl"
          title="Endorse & forward?"
          icon={
            <span className="text-primary" aria-hidden>
              <Send size={14} />
            </span>
          }
          description={`Moves ${row.student}'s case to the ADM coordinator for the parent meeting.`}
          footer={
            <div className="flex justify-end gap-1.5 px-1 pb-1">
              <Button variant="outline" size="sm" onClick={onClose} autoFocus>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirm}>
                <Send aria-hidden />
                Endorse & forward
              </Button>
            </div>
          }
        >
          <div className="flex items-center gap-2 px-1">
            <StudentMascot
              name={row.student}
              seed={row.lrn}
              character={row.mascot ?? undefined}
              size={32}
            />
            <span className="min-w-0 truncate text-sm font-semibold text-primary">
              {row.student}
            </span>
            <span
              className={`${PILL_BASE} ${PILL_SECONDARY} tabular-nums`}
              title={row.lrn}
            >
              {row.lrn}
            </span>
            {row.category !== "—" && (
              <span
                className={`${PILL_BASE} ${
                  anecdotalCategoryPillClass(row.category) ?? PILL_SECONDARY
                }`}
              >
                {row.category}
              </span>
            )}
          </div>
          <p className="px-1 text-xs text-muted-foreground">
            The case shows as Endorsed on your board while the coordinator
            takes over.
          </p>
        </KanbanBoard>
      </div>
    </div>
  );
}
