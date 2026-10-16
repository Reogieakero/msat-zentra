"use client";

import * as React from "react";
import { useDock } from "@/components/dock/dock-store";
import type { ScoreSavePhase, ScoreSaveRow } from "./ScoreSaveDock";

export interface ScoreSaveDetail {
  title: string;
  pills: string[];
  rows: ScoreSaveRow[];
}

interface ScoreSaveState {
  phase: ScoreSavePhase;
  message: string | null;
  title: string | null;
  pills: string[];
  rows: ScoreSaveRow[];
}

interface ScoreSaveValue {
  saveState: ScoreSaveState | null;
  reportScorePhase: (
    phase: ScoreSavePhase,
    detail?: ScoreSaveDetail | null,
    message?: string | null,
  ) => void;
  dismissScoreSave: () => void;
}

const ScoreSaveContext = React.createContext<ScoreSaveValue | null>(null);

export function useScoreSave(): ScoreSaveValue {
  const ctx = React.useContext(ScoreSaveContext);
  if (!ctx) throw new Error("useScoreSave must be used inside ScoreSaveProvider");
  return ctx;
}

// Score saves now report into the single shared Dock.
// Local state is kept so existing callers keep working, but no
// separate panel is rendered anymore.
export function ScoreSaveProvider({ children }: { children: React.ReactNode }) {
  const dock = useDock();
  const dockRef = React.useRef(dock);
  React.useEffect(() => {
    dockRef.current = dock;
  }, [dock]);
  const [save, setSave] = React.useState<ScoreSaveState | null>(null);
  const taskIdRef = React.useRef<string | null>(null);

  const dismissScoreSave = React.useCallback(() => {
    setSave(null);
    try {
      for (const t of dockRef.current.tasks) {
        if (t.kind === "score-save" && t.status !== "running" && t.status !== "waiting") {
          dockRef.current.dismissTask(t.id);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const reportScorePhase = React.useCallback(
    (phase: ScoreSavePhase, detail?: ScoreSaveDetail | null, message?: string | null) => {
      setSave((prev) => ({
        phase,
        message: message ?? null,
        title: detail?.title ?? prev?.title ?? null,
        pills: detail?.pills ?? prev?.pills ?? [],
        rows: detail?.rows ?? prev?.rows ?? [],
      }));
      try {
        const d = dockRef.current;
        const rows = detail?.rows ?? [];
        const saved = rows.filter((r) => r.state === "saved").length;
        const total = rows.length;
        if (phase === "saving") {
          taskIdRef.current = d.startTask({
            kind: "score-save",
            title: "Saving scores",
            description: detail?.title ? `${detail.title} · ${total} student${total === 1 ? "" : "s"}` : `Saving ${total} score${total === 1 ? "" : "s"}…`,
            total: total > 0 ? total : undefined,
          });
        } else if (phase === "saved") {
          const id = taskIdRef.current;
          taskIdRef.current = null;
          const targetId =
            id ?? d.tasks.filter((t) => t.kind === "score-save" && t.status === "running").sort((a, b) => b.createdAt - a.createdAt)[0]?.id;
          if (targetId) {
            d.updateTask(targetId, {
              title: "Scores saved",
              description: detail?.title ? `${detail.title} · ${saved} of ${total} saved` : message ?? `${saved} of ${total} saved`,
              progress: total > 0 ? { done: total, total } : null,
            });
            d.completeTask(targetId);
          }
        } else {
          const id = taskIdRef.current;
          taskIdRef.current = null;
          const targetId =
            id ?? d.tasks.filter((t) => t.kind === "score-save" && t.status === "running").sort((a, b) => b.createdAt - a.createdAt)[0]?.id;
          if (targetId) d.failTask(targetId, message ?? "Scores failed to save.");
        }
      } catch {
        /* shared Dock unavailable — keep local state only */
      }
    },
    [],
  );

  const value = React.useMemo(
    () => ({ saveState: save, reportScorePhase, dismissScoreSave }),
    [save, reportScorePhase, dismissScoreSave],
  );

  return <ScoreSaveContext.Provider value={value}>{children}</ScoreSaveContext.Provider>;
}
