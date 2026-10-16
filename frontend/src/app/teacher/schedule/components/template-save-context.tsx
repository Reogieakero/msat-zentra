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
      if (!next) {
        const id = taskIdRef.current;
        taskIdRef.current = null;
        if (id) {
          // Dismiss is explicit via dismiss(); dropping progress to null
          // without dismiss (e.g. unmount) leaves the shared task alone.
        }
        return;
      }
      if (next.active && (!prev || !prev.active)) {
        taskIdRef.current = d.startTask({
          kind: "timetable-save",
          title: "Saving timetable",
          description: `${next.sectionName} · ${next.batchTotal} slot${next.batchTotal === 1 ? "" : "s"}`,
          total: next.batchTotal,
        });
        return;
      }
      const id = taskIdRef.current;
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

  const setProgress = React.useCallback(
    (action: React.SetStateAction<SaveProgress | null>) => {
      setProgressState((prev) => {
        const next = typeof action === "function" ? (action as (p: SaveProgress | null) => SaveProgress | null)(prev) : action;
        syncToDock(next, prev);
        return next;
      });
    },
    [syncToDock],
  );

  const dismiss = React.useCallback(() => {
    setProgressState(null);
    taskIdRef.current = null;
    try {
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
