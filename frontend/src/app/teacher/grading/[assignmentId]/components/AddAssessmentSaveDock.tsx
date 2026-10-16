"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { ProgressDock } from "@/components/ui/progress-dock";
import { AmberRectPill } from "../../../classes/components/UnlinkCodeDialog";

export type AddAssessmentSavePhase = "adding" | "added" | "error";

export interface AddAssessmentSaveDetail {
  title: string;
  pills: string[];
}

type Props = {
  phase: AddAssessmentSavePhase;
  message: string | null;
  assessmentTitle: string | null;
  assessmentPills: string[];
  onDismiss: () => void;
};

const ADD_STEPS = ["Validating details", "Creating assessment", "Ready for score encoding"];

export function AddAssessmentSaveDock({
  phase,
  message,
  assessmentTitle,
  assessmentPills,
  onDismiss,
}: Props) {
  const working = phase === "adding";
  const title =
    phase === "adding"
      ? "Adding assessment"
      : phase === "added"
        ? "Assessment added"
        : "Could not add assessment";
  const rowStatus =
    phase === "added" ? "Ready" : phase === "error" ? "Failed" : "Adding…";

  return (
    <ProgressDock
      title={title}
      working={working}
      steps={phase === "added" ? ADD_STEPS : ADD_STEPS.slice(0, 2)}
      label={assessmentTitle ? `Adding "${assessmentTitle}"…` : "Adding assessment…"}
      doneLabel="Assessment added"
      summary={
        phase === "error" ? (
          <span className="text-destructive">{message ?? "Assessment failed to save."}</span>
        ) : (
          (message ?? (phase === "added" ? "Ready for score encoding." : null))
        )
      }
      onDismiss={onDismiss}
    >
      {assessmentTitle ? (
        <ul className="flex min-w-0 flex-col gap-1" aria-label="Assessment being saved">
          <li className="flex min-w-0 items-center gap-2 rounded px-1 py-1">
            <span className="shrink-0" aria-hidden>
              {phase === "added" ? (
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
              {rowStatus}
            </span>
          </li>
        </ul>
      ) : null}
    </ProgressDock>
  );
}
