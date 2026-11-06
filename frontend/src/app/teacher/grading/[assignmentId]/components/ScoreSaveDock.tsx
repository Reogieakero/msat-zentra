"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { ProgressDock } from "@/components/ui/progress-dock";
import { Pill } from "@/components/ui/pill";
import styles from "./ScoreSaveDock.module.css";

export type ScoreSavePhase = "saving" | "saved" | "error";

export interface ScoreSaveRow {
  id: string;
  name: string;
  meta: string;
  state: "saving" | "saved" | "failed";
}

type Props = {
  phase: ScoreSavePhase;
  message: string | null;
  assessmentTitle: string | null;
  assessmentPills: string[];
  rows: ScoreSaveRow[];
  onDismiss: () => void;
};

const SAVE_STEPS = ["Validating scores", "Saving to server", "Confirming grades"];

export function ScoreSaveDock({
  phase,
  message,
  assessmentTitle,
  assessmentPills,
  rows,
  onDismiss,
}: Props) {
  const working = phase === "saving";
  const title =
    phase === "saving"
      ? "Saving scores"
      : phase === "saved"
        ? "Scores saved"
        : "Scores not saved";
  const savedCount = rows.filter((r) => r.state === "saved").length;
  const failedCount = rows.filter((r) => r.state === "failed").length;

  return (
    <ProgressDock
      title={title}
      working={working}
      steps={phase === "saved" ? SAVE_STEPS : SAVE_STEPS.slice(0, 2)}
      label={assessmentTitle ? `Saving "${assessmentTitle}"…` : "Saving scores…"}
      doneLabel="Scores saved"
      summary={
        phase === "error" ? (
          <span className="text-destructive">{message ?? "Scores failed to save."}</span>
        ) : (
          (message ??
            (rows.length > 0
              ? `${savedCount} saved of ${rows.length}${failedCount > 0 ? ` · ${failedCount} failed` : ""}`
              : (phase === "saved" ? "Grades confirmed." : null)))
        )
      }
      onDismiss={onDismiss}
    >
      {assessmentTitle || assessmentPills.length > 0 ? (
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-1" aria-label={assessmentTitle ?? undefined}>
          {assessmentPills.map((pill) => (
            <Pill key={pill} tone="amber" label="Assessment">
              {pill}
            </Pill>
          ))}
        </div>
      ) : null}
      {rows.length > 0 ? (
        <ul
          className={`${styles.rows} flex max-h-56 min-w-0 flex-col gap-1 overflow-y-auto`}
          aria-label="Students in this save"
        >
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex min-w-0 items-center gap-2 rounded px-1 py-1"
            >
              <span className="shrink-0" aria-hidden>
                {r.state === "saved" ? (
                  <CheckCircle2
                    size={15}
                    className="text-emerald-600 dark:text-emerald-400"
                  />
                ) : r.state === "failed" ? (
                  <XCircle size={15} className="text-destructive" />
                ) : (
                  <Loader2
                    size={15}
                    className="animate-spin text-muted-foreground"
                  />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-medium" title={r.name}>
                  {r.name}
                </span>
                <span
                  className="truncate text-[11px] text-muted-foreground"
                  title={r.meta}
                >
                  {r.meta}
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {r.state === "saved"
                  ? "Saved"
                  : r.state === "failed"
                    ? "Failed"
                    : "Saving…"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </ProgressDock>
  );
}
