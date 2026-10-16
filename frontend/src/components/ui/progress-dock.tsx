"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThoughtLine from "@/components/ui/thought-line/ThoughtLine";

export interface ProgressDockProps {
  /** Header title, e.g. "Saving timetable · 3/8". */
  title: string;
  /** Real-time count badge shown next to the title (e.g. updated students). */
  badge?: number;
  /** True while work is in flight — drives the ThoughtLine and locks dismiss. */
  working: boolean;
  /** Verification trace shown in the ThoughtLine. */
  steps: string[];
  /** ThoughtLine label while working. */
  label: string;
  /** ThoughtLine label once settled. */
  doneLabel: string;
  /** Optional centered line under the ThoughtLine (counts, hints). */
  summary?: React.ReactNode;
  /** Optional rows (per-item status, actions) under the summary. */
  children?: React.ReactNode;
  /** Dismiss action. Ignored while `dismissDisabled`. */
  onDismiss: () => void;
  /** Defaults to `working`. */
  dismissDisabled?: boolean;
  showTimer?: boolean;
  ariaLabel?: string;
}

export function ProgressDock({
  title,
  badge,
  working,
  steps,
  label,
  doneLabel,
  summary,
  children,
  onDismiss,
  dismissDisabled,
  showTimer = true,
  ariaLabel,
}: ProgressDockProps) {
  const [minimized, setMinimized] = React.useState(false);
  const locked = dismissDisabled ?? working;

  return (
    <div
      className="fixed right-4 bottom-4 z-50 w-80 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl sm:w-96"
      role="status"
      aria-live="polite"
      aria-label={ariaLabel ?? title}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{title}</span>
        {typeof badge === "number" ? (
          <span
            aria-live="polite"
            aria-label={`${badge} updated`}
            className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
              working
                ? "animate-pulse bg-amber-500 text-black"
                : "bg-green-600 text-white dark:bg-green-500 dark:text-black"
            }`}
          >
            {badge}
          </span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 shrink-0 px-0"
          onClick={() => setMinimized((m) => !m)}
          aria-label={minimized ? "Expand progress status" : "Minimize progress status"}
        >
          {minimized ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 shrink-0 px-0"
          onClick={onDismiss}
          disabled={locked}
          aria-label="Dismiss progress status"
        >
          <X size={14} aria-hidden />
        </Button>
      </div>
      {!minimized ? (
        <div className="flex flex-col gap-2 p-3">
          <div className="flex justify-center">
            <ThoughtLine
              working={working}
              steps={steps}
              label={label}
              doneLabel={doneLabel}
              fontSize={13}
              collapsible
              collapseOnSettle
              showTimer={showTimer}
            />
          </div>
          {summary ? (
            <p className="text-center text-xs text-muted-foreground" aria-live="polite">
              {summary}
            </p>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}
