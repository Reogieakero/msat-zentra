"use client";

import * as React from "react";
import { useDock } from "@/components/dock/dock-store";
import type { SaveProgress } from "./use-schedule-cells";

interface TemplateSaveContextValue {
  progress: SaveProgress | null;
  setProgress: React.Dispatch<React.SetStateAction<SaveProgress | null>>;
  dismiss: () => void;
}

const TemplateSaveContext = React.createContext<TemplateSaveContextValue | null>(null);

export function useTemplateSaveProgress(): TemplateSaveContextValue | null {
  return React.useContext(TemplateSaveContext);
}

// Timetable saves now report into the single shared Dock.
export function TemplateSaveProvider({ children }: { children: React.ReactNode }) {
  const dock = useDock();
  const dockRef = React.useRef(dock);
  React.useEffect(() => {
    dockRef.current = dock;
  }, [dock]);
  const [progress, setProgressState] = React.useState<SaveProgress | null>(null);
  const taskIdRef = React.useRef<string | null>(null);

  const syncToDock = React.useCallback((next: SaveProgress | null, prev: SaveProgress | null) => {
    try {
      const d = dockRef.current;
      const id = taskIdRef.current;
      if (!next) {
        taskIdRef.current = null;
        // Nothing will report on this task any more — never leave it spinning.
        if (id) d.cancelTask(id);
        return;
      }
      if (next.active && (!prev || !prev.active)) {
        // A new save batch must never orphan the previous task: the old id is
        // about to be dropped, so close it out first. Without this, one stray
        // duplicate start leaves a running task the heartbeat keeps alive
        // forever ("Working on 1 task" that never finishes).
        if (id) d.cancelTask(id);
        taskIdRef.current = d.startTask({
          kind: "timetable-save",
          title: "Saving timetable",
          description: `${next.sectionName} · ${next.batchTotal} slot${next.batchTotal === 1 ? "" : "s"}`,
          total: next.batchTotal,
        });
        return;
      }
      if (!id) return;
      const totalRows = next.rows.length;
      const settled = next.rows.filter((r) => r.status !== "saving").length;
      const batchDone = Math.max(0, settled - (totalRows - next.batchTotal));
      const failed = next.rows.filter((r) => r.status === "failed").length;
      if (next.active) {
        d.updateTask(id, {
          title: "Saving timetable",
          description: `${next.sectionName} · ${batchDone}/${next.batchTotal}`,
          progress: { done: batchDone, total: next.batchTotal },
        });
      } else if (next.done) {
        taskIdRef.current = null;
        if (failed > 0) {
          d.updateTask(id, {
            title: "Timetable saved with issues",
            description: `${next.sectionName} · ${failed} failed — kept staged for retry`,
            progress: { done: next.batchTotal, total: next.batchTotal },
          });
          d.failTask(id, `${failed} slot${failed === 1 ? "" : "s"} failed — kept staged for retry.`);
        } else {
          d.updateTask(id, {
            title: "Timetable saved",
            description: `${next.sectionName} · ${next.batchTotal} slot${next.batchTotal === 1 ? "" : "s"} saved`,
            progress: { done: next.batchTotal, total: next.batchTotal },
          });
          d.completeTask(id);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setProgress = React.useCallback((action: React.SetStateAction<SaveProgress | null>) => {
    setProgressState(action);
  }, []);

  // Dock writes must never run inside a state updater: React executes updaters
  // during render, and updating DockProvider from another component's render
  // throws "Cannot update a component while rendering a different component".
  // Sync after commit instead, diffing against the previous progress value.
  const prevProgressRef = React.useRef<SaveProgress | null>(null);
  React.useEffect(() => {
    const prev = prevProgressRef.current;
    prevProgressRef.current = progress;
    syncToDock(progress, prev);
  }, [progress, syncToDock]);

  const dismiss = React.useCallback(() => {
    const id = taskIdRef.current;
    taskIdRef.current = null;
    setProgressState(null);
    try {
      // A still-running task for this batch would otherwise spin until the tab
      // closes, so cancel it before clearing finished ones.
      if (id) dockRef.current.cancelTask(id);
      for (const t of dockRef.current.tasks) {
        if (t.kind === "timetable-save" && t.status !== "running" && t.status !== "waiting") {
          dockRef.current.dismissTask(t.id);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const value = React.useMemo(() => ({ progress, setProgress, dismiss }), [progress, setProgress, dismiss]);

  return <TemplateSaveContext.Provider value={value}>{children}</TemplateSaveContext.Provider>;
}
