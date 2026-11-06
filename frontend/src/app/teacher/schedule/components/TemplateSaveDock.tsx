"use client";
import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, Minus, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThoughtLine from "@/components/ui/thought-line/ThoughtLine";
import { WEEK_LABELS_SHORT } from "@/services/teacher/schedule";
import type { SaveProgress } from "./use-schedule-cells";
import stepperStyles from "./template-stepper.module.css";

const SAVE_STEPS = ["Staging slots", "Saving to server", "Confirming timetable"];

interface Props {
  sectionName: string;
  progress: SaveProgress;
  onDismiss: () => void;
}

function rowStateLabel(status: string): string {
  if (status === "saved") return "Saved";
  if (status === "warned") return "Saved with warning";
  if (status === "failed") return "Failed";
  if (status === "empty") return "Empty";
  return "Saving…";
}

export function TemplateSaveDock({ sectionName, progress, onDismiss }: Props) {
  const [minimized, setMinimized] = useState(false);
  const total = progress.rows.length;
  const batchTotal = progress.batchTotal;
  const batchDone = progress.rows.filter((r) => r.status !== "saving").length - (total - batchTotal);
  const doneCount = Math.max(0, batchDone);
  const failedCount = progress.rows.filter((r) => r.status === "failed").length;
  const warnedCount = progress.rows.filter((r) => r.status === "warned").length;
  const header = progress.active
    ? `Saving timetable · ${doneCount}/${batchTotal}`
    : failedCount > 0
      ? `Save finished · ${failedCount} failed`
      : "Save complete";
  const step = progress.done ? SAVE_STEPS.length : doneCount > 0 ? 2 : 1;

  return (
    <div
      className="fixed right-4 bottom-4 z-50 w-80 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl sm:w-96"
      role="status"
      aria-live="polite"
      aria-label={header}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{header}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 px-2"
          onClick={() => setMinimized((m) => !m)}
          aria-label={minimized ? "Expand save status" : "Minimize save status"}
        >
          {minimized ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 px-2"
          onClick={onDismiss}
          disabled={progress.active}
          aria-label="Dismiss save status"
        >
          <X size={14} aria-hidden />
        </Button>
      </div>
      {!minimized ? (
        <div className="flex flex-col gap-2 p-3">
          <div className="flex justify-center">
            <ThoughtLine
              working={progress.active}
              steps={SAVE_STEPS.slice(0, step)}
              label={`Saving ${batchTotal} slot${batchTotal === 1 ? "" : "s"} for ${sectionName}…`}
              doneLabel="Timetable saved"
              fontSize={13}
              collapsible
              collapseOnSettle
              showTimer
            />
          </div>
          {warnedCount > 0 || failedCount > 0 ? (
            <p className="text-center text-xs text-muted-foreground" aria-live="polite">
              {warnedCount > 0 ? `${warnedCount} warning${warnedCount === 1 ? "" : "s"}` : ""}
              {warnedCount > 0 && failedCount > 0 ? " · " : ""}
              {failedCount > 0 ? `${failedCount} failed — kept staged for retry` : ""}
            </p>
          ) : null}
          <ul className={`${stepperStyles.dockRows} flex max-h-48 flex-col gap-1 overflow-y-auto pr-0.5`}>
            {progress.rows.map((row) => (
              <li
                key={row.key}
                className="flex items-center gap-2 rounded-md border border-input px-2 py-1.5 text-xs"
              >
                <span aria-hidden>
                  {row.status === "saving" ? (
                    <Loader2 size={13} className="animate-spin text-amber-500" />
                  ) : row.status === "failed" ? (
                    <TriangleAlert size={13} className="text-destructive" />
                  ) : row.status === "empty" ? (
                    <Minus size={13} className="text-muted-foreground" />
                  ) : (
                    <Check size={13} className={row.status === "warned" ? "text-amber-500" : "text-green-500"} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {row.subjectName} · {row.teacherName}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {WEEK_LABELS_SHORT[row.day - 1] ?? `Day ${row.day}`} · Period {row.period + 1}
                    {row.message ? ` — ${row.message}` : ""}
                  </span>
                </span>
                <span
                  className={
                    row.status === "failed"
                      ? "shrink-0 text-[11px] font-medium text-destructive"
                      : row.status === "warned"
                        ? "shrink-0 text-[11px] font-medium text-amber-600 dark:text-amber-500"
                        : row.status === "saved"
                          ? "shrink-0 text-[11px] font-medium text-green-600 dark:text-green-500"
                          : "shrink-0 text-[11px] text-muted-foreground"
                  }
                >
                  {rowStateLabel(row.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
