"use client";

import { Ban, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { dockStatusLabel, type DockTask } from "./dock-types";

function RowIcon({ status }: { status: DockTask["status"] }) {
  const size = 15;
  if (status === "done") return <CheckCircle2 size={size} aria-hidden className="text-emerald-600 dark:text-emerald-400" />;
  if (status === "failed") return <XCircle size={size} aria-hidden className="text-destructive" />;
  if (status === "cancelled") return <Ban size={size} aria-hidden className="text-muted-foreground" />;
  if (status === "waiting") return <Clock size={size} aria-hidden className="text-muted-foreground" />;
  return <Loader2 size={size} aria-hidden className="animate-spin text-muted-foreground" />;
}

/**
 * One uniform row: icon left, details middle, status text right.
 * Fixed widths keep every row lined up; long text is cut short.
 * No buttons here — the single X in the Dock header clears everything.
 */
export function DockRow({ task }: { task: DockTask }) {
  const rightText = dockStatusLabel(task);

  return (
    <li className="flex min-w-0 items-center gap-2 rounded px-1 py-1">
      <span className="flex w-[15px] shrink-0 items-center justify-center" aria-hidden>
        <RowIcon status={task.status} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-medium" title={task.title}>
          {task.title}
        </span>
        <span className="truncate text-[11px] text-muted-foreground" title={task.error ?? task.description}>
          {task.status === "failed" && task.error ? task.error : task.description}
        </span>
      </span>
      <span className="w-[72px] shrink-0 truncate text-right text-[11px] tabular-nums text-muted-foreground" title={rightText}>
        {rightText}
      </span>
    </li>
  );
}
