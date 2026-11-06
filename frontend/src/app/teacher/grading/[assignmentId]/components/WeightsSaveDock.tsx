"use client";

import { Scale } from "lucide-react";
import { ProgressDock } from "@/components/ui/progress-dock";
import { Pill } from "@/components/ui/pill";

export type WeightsSavePhase = "saving" | "saved" | "error";

type Props = {
  phase: WeightsSavePhase;
  message: string | null;
  pills: string[];
  onDismiss: () => void;
};

const SAVE_STEPS = ["Validating shares", "Saving to server", "Confirming total 100%"];

export function WeightsSaveDock({ phase, message, pills, onDismiss }: Props) {
  const working = phase === "saving";
  const title =
    phase === "saving" ? "Saving weights" : phase === "saved" ? "Weights saved" : "Could not save weights";

  return (
    <ProgressDock
      title={title}
      working={working}
      steps={phase === "saved" ? SAVE_STEPS : SAVE_STEPS.slice(0, 2)}
      label="Applying weights…"
      doneLabel="Weights saved"
      summary={
        phase === "error" ? (
          <span className="text-destructive">{message ?? "Weights failed to save."}</span>
        ) : (
          <span className="flex min-w-0 flex-col items-stretch gap-1 text-left">
            {pills.length > 0 ? (
              <span
                className="flex min-w-0 items-center gap-2 rounded px-1 py-1"
                aria-label={pills.join(", ")}
              >
                <span className="shrink-0 text-amber-500" aria-hidden="true">
                  <Scale size={15} />
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-1">
                  {pills.map((pill) => (
                    <Pill key={pill} tone="amber" label="Category weight">
                      {pill}
                    </Pill>
                  ))}
                </span>
              </span>
            ) : null}
            {message ? (
              <span className="px-1 text-xs text-muted-foreground">{message}</span>
            ) : null}
          </span>
        )
      }
      onDismiss={onDismiss}
    />
  );
}
