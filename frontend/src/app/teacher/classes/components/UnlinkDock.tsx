"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThoughtLine from "@/components/ui/thought-line/ThoughtLine";

export type UnlinkPhase = "working" | "done" | "error";

export interface UnlinkDockState {
  phase: UnlinkPhase;
  name: string;
  code: string | null;
  error?: string | null;
}

const UNLINK_STEPS = [
  "Verifying link code",
  "Clearing classes",
  "Clearing grading & attendance",
];

export function UnlinkDock({
  dock,
  onDismiss,
}: {
  dock: UnlinkDockState;
  onDismiss: () => void;
}) {
  const [minimized, setMinimized] = React.useState(false);
  const working = dock.phase === "working";

  const step = dock.phase === "done" ? UNLINK_STEPS.length - 1 : dock.phase === "error" ? 0 : 1;
  const header =
    dock.phase === "working"
      ? "Unlinking code"
      : dock.phase === "error"
        ? "Unlink failed"
        : "Code unlinked";

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-80 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl sm:w-96"
      style={{
        fontFamily: "Inter, var(--font-inter), var(--font-sans), ui-sans-serif, system-ui, sans-serif",
      }}
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
          className="h-7 shrink-0 px-2"
          onClick={() => setMinimized((m) => !m)}
          aria-label={minimized ? "Expand unlink status" : "Minimize unlink status"}
        >
          {minimized ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2"
          onClick={onDismiss}
          disabled={working}
          aria-label="Dismiss unlink status"
        >
          <X size={14} aria-hidden />
        </Button>
      </div>
      {!minimized ? (
        <div className="flex flex-col gap-2 p-3">
          <div className="flex justify-center">
            <ThoughtLine
              working={working}
              steps={UNLINK_STEPS.slice(0, step + 1)}
              label={dock.code ? `Unlinking ${dock.code}…` : "Unlinking code…"}
              doneLabel="Code unlinked"
              fontSize={13}
              collapsible
              collapseOnSettle
              showTimer
            />
          </div>
          {dock.phase === "done" ? (
            <p className="text-center text-xs text-muted-foreground" aria-live="polite">
              {dock.code ? `${dock.code} unlinked` : "Code unlinked"} · classes, grading,
              attendance cleared
            </p>
          ) : null}
          {dock.phase === "error" && dock.error ? (
            <p role="alert" className="text-center text-xs text-destructive">
              {dock.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
