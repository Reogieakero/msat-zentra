"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { ProgressDock } from "@/components/ui/progress-dock";
import { AmberRectPill } from "../../../classes/components/UnlinkCodeDialog";

export type DeleteAssessmentSavePhase = "deleting" | "deleted" | "error";

type Props = {
  phase: DeleteAssessmentSavePhase;
  message: string | null;
  assessmentTitle: string | null;
  assessmentPills: string[];
  onDismiss: () => void;
};

const DELETE_STEPS = ["Verifying assessment", "Removing encoded scores", "Deleting assessment"];

export function DeleteAssessmentSaveDock({
  phase,
  message,
  assessmentTitle,
  assessmentPills,
  onDismiss,
}: Props) {
  const working = phase === "deleting";
  const title =
    phase === "deleting"
      ? "Deleting assessment"
      : phase === "deleted"
        ? "Assessment deleted"
        : "Could not delete assessment";

  return (
    <ProgressDock
      title={title}
      working={working}
      steps={phase === "deleted" ? DELETE_STEPS : DELETE_STEPS.slice(0, 2)}
      label={assessmentTitle ? `Deleting "${assessmentTitle}"…` : "Deleting assessment…"}
      doneLabel="Assessment deleted"
      summary={
        phase === "error" ? (
          <span className="text-destructive">{message ?? "Assessment failed to delete."}</span>
        ) : (
          (message ?? (phase === "deleted" ? "Scores removed with it." : null))
        )
      }
      onDismiss={onDismiss}
    >
      {assessmentTitle ? (
        <ul className="flex min-w-0 flex-col gap-1" aria-label="Assessment being deleted">
          <li className="flex min-w-0 items-center gap-2 rounded px-1 py-1">
            <span className="shrink-0" aria-hidden>
              {phase === "deleted" ? (
                <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
              ) : phase === "error" ? (
                <XCircle size={15} className="text-destructive" />
              ) : (
                <Loader2 size={15} className="animate-spin text-muted-foreground" />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-xs font-medium" title={assessmentTitle}>
                {assessmentTitle}
              </span>
              {assessmentPills.length > 0 ? (
                <span
                  className="flex min-w-0 flex-wrap items-center gap-1"
                  aria-label={assessmentPills.join(", ")}
                >
                  {assessmentPills.map((pill) => (
                    <AmberRectPill key={pill}>{pill}</AmberRectPill>
                  ))}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {phase === "deleted" ? "Deleted" : phase === "error" ? "Failed" : "Deleting…"}
            </span>
          </li>
        </ul>
      ) : null}
    </ProgressDock>
  );
}
