"use client";

import * as React from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ThoughtLine from "@/components/ui/thought-line/ThoughtLine";

interface BamaSubmitDockProps {
  submitting: boolean;
  filed: boolean;
  sectionName: string;
  studentCount: number;
}

// Bottom-right submit dock for chat SF10 access requests — same shell as the
// record-keeper/overview bulk dock (fixed, ThoughtLine, 100% Inter). No
// polling or staged timers: it mirrors the submit POST directly, so it adds
// no latency; the success flash auto-hides.
const SUBMIT_STEPS = [
  "Sending access request",
  "Verifying advisory LRNs",
  "Filing request",
];

export function BamaSubmitDock({ submitting, filed, sectionName, studentCount }: BamaSubmitDockProps) {
  const [flash, setFlash] = React.useState(false);
  const [minimized, setMinimized] = React.useState(false);
  const wasSubmitting = React.useRef(false);
  const hideTimer = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    },
    [],
  );

  React.useEffect(() => {
    if (submitting) {
      wasSubmitting.current = true;
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setFlash(false), 0);
      return;
    }
    if (wasSubmitting.current && filed) {
      wasSubmitting.current = false;
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
      // Stays up until the teacher dismisses it — never auto-closes.
      hideTimer.current = window.setTimeout(() => {
        setFlash(true);
      }, 0);
      return;
    }
    wasSubmitting.current = false;
  }, [submitting, filed]);

  if (!submitting && !flash) return null;

  return (
    <div
      className="fixed right-4 bottom-4 z-50 w-80 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl [font-family:var(--font-inter)] sm:w-96"
      role="status"
      aria-live="polite"
      aria-label={submitting ? "Sending SF10 access request" : "SF10 access request sent"}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {submitting ? "Sending SF10 request" : "Request sent"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2"
          onClick={() => setMinimized(!minimized)}
          aria-label={minimized ? "Expand request status" : "Minimize request status"}
        >
          {minimized ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2"
          onClick={() => setFlash(false)}
          disabled={submitting}
          aria-label="Dismiss request status"
        >
          <X size={14} aria-hidden />
        </Button>
      </div>
      {!minimized ? (
        <div className="flex flex-col gap-2 p-3">
          <div className="flex justify-center">
            <ThoughtLine
              working={submitting}
              steps={SUBMIT_STEPS}
              label="Sending request…"
              doneLabel="Request sent"
              fontSize={13}
              collapsible
              collapseOnSettle
              showTimer
            />
          </div>
          <ul className="flex min-w-0 flex-col gap-1" aria-label="Request progress">
            <li className="flex min-w-0 items-center gap-2 rounded px-1 py-1">
              <span className="shrink-0" aria-hidden>
                {submitting ? (
                  <Loader2 size={15} className="animate-spin text-muted-foreground" />
                ) : (
                  <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs" title={sectionName || "Advisory section"}>
                {sectionName || "Advisory section"}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {submitting ? "Sending…" : "Sent"}
              </span>
            </li>
            <li className="flex min-w-0 items-center gap-2 rounded px-1 py-1">
              <span className="shrink-0" aria-hidden>
                {submitting ? (
                  <Users size={15} className="text-muted-foreground" />
                ) : (
                  <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs">
                {studentCount} student{studentCount === 1 ? "" : "s"}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {submitting ? "Verifying…" : "Done"}
              </span>
            </li>
          </ul>
          {submitting && sectionName ? (
            <p className="truncate text-[11px] text-muted-foreground" title={sectionName}>
              Now sending: {sectionName}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
