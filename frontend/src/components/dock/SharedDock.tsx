"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThoughtLine from "@/components/ui/thought-line/ThoughtLine";
import { useDock } from "./dock-store";
import { DockRow } from "./DockRow";

function sortTasks<T extends { status: string; createdAt: number }>(list: T[]): T[] {
  const rank = (s: string) => (s === "running" ? 0 : s === "waiting" ? 1 : s === "failed" ? 2 : s === "cancelled" ? 3 : 4);
  return [...list].sort((a, b) => rank(a.status) - rank(b.status) || b.createdAt - a.createdAt);
}

/**
 * One single bottom-right box for every task.
 * - Never closes by itself: only the X clears finished tasks,
 *   and X is locked while anything is running.
 * - ThoughtLine on top shows the shared status.
 * - Every row uses the same DockRow layout.
 */
export function SharedDock() {
  const pathname = usePathname();
  const { tasks, dismissAllCompleted } = useDock();
  const [minimized, setMinimized] = React.useState(false);

  if (pathname === "/login") return null;
  if (tasks.length === 0) return null;

  const ordered = sortTasks(tasks);
  const runningCount = tasks.filter((t) => t.status === "running").length;
  const waitingCount = tasks.filter((t) => t.status === "waiting").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const working = runningCount > 0;
  const header = working
    ? `Working on ${runningCount} task${runningCount === 1 ? "" : "s"}${waitingCount > 0 ? ` · ${waitingCount} waiting` : ""}`
    : doneCount > 0 && doneCount === tasks.length
      ? "All tasks done"
      : "Tasks finished";

  const steps = ordered.slice(0, 4).map((t) => t.title);

  return (
    <div
      className="fixed right-4 bottom-4 z-50 w-80 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl sm:w-96 [font-family:var(--font-inter)]"
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
          className="h-6 w-6 shrink-0 px-0"
          onClick={() => setMinimized((m) => !m)}
          aria-label={minimized ? "Expand tasks" : "Minimize tasks"}
        >
          {minimized ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 shrink-0 px-0"
          onClick={dismissAllCompleted}
          disabled={working}
          aria-label="Dismiss finished tasks"
          title={working ? "Wait until tasks finish" : "Dismiss finished tasks"}
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
              label={working ? `Working on ${runningCount} task${runningCount === 1 ? "" : "s"}…` : "All tasks finished"}
              doneLabel="All tasks done"
              fontSize={13}
              collapsible
              collapseOnSettle
              showTimer
            />
          </div>
          <ul className="flex max-h-56 min-w-0 flex-col gap-1 overflow-y-auto" aria-label="Tasks">
            {ordered.map((t) => (
              <DockRow key={t.id} task={t} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
