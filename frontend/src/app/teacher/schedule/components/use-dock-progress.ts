"use client";

import * as React from "react";
import { useDock } from "@/components/dock/dock-store";
import type { DockTaskKind } from "@/components/dock/dock-types";

/**
 * Normalized view of a page-local progress state, so any confirmed action can
 * report into the one shared Dock (`components/dock`) instead of drawing its
 * own floating panel.
 */
export interface DockSnapshot {
  /** True while the request is in flight. */
  active: boolean;
  /** Set when the action settled with at least one failed item. */
  failed?: boolean;
  /** Shown as the dock row title. */
  title: string;
  /** One-line detail under the title. */
  description: string;
  /** Optional row count so the dock can show done/total. */
  total?: number;
}

/**
 * Mirrors a progress snapshot into the shared Dock: starts a task when work
 * begins, keeps its title/description fresh while it runs, then completes or
 * fails it once settled. Dropping the snapshot (state back to `null`) also
 * settles the task, so pages that clear their progress state on finish never
 * leave a row spinning.
 */
export function useDockProgressTask(
  snapshot: DockSnapshot | null,
  kind: DockTaskKind = "generic",
): void {
  const dock = useDock();
  const dockRef = React.useRef(dock);
  React.useEffect(() => {
    dockRef.current = dock;
  }, [dock]);

  const taskIdRef = React.useRef<string | null>(null);
  const active = snapshot?.active ?? false;
  const failed = snapshot?.failed ?? false;
  const title = snapshot?.title ?? "";
  const description = snapshot?.description ?? "";
  const total = snapshot?.total ?? null;

  React.useEffect(() => {
    const d = dockRef.current;
    if (active) {
      if (!taskIdRef.current) {
        taskIdRef.current = d.startTask({
          kind,
          title: title || "Working",
          description,
          total: total ?? undefined,
        });
      } else {
        d.updateTask(taskIdRef.current, { title, description, status: "running" });
      }
      return;
    }
    const id = taskIdRef.current;
    if (!id) return;
    taskIdRef.current = null;
    if (failed) d.failTask(id, description || "Please try again.");
    else d.completeTask(id, description || undefined);
  }, [active, failed, title, description, total, kind]);
}
