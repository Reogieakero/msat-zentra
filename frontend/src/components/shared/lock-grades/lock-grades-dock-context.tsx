"use client";

import * as React from "react";
import { useDock } from "@/components/dock/dock-store";

type LockPhase = "locking" | "done" | "error";

interface LockJob {
  phase: LockPhase;
  subjectLabel: string;
  termLabel: string;
  locked: number;
  total: number;
  message: string | null;
}

interface LockGradesDockValue {
  job: LockJob | null;
  startLock: (input: { subjectLabel: string; termLabel: string; total: number }) => void;
  finishLock: (ok: boolean, input: { locked: number; total: number; message?: string }) => void;
  dismiss: () => void;
}

const LockGradesDockContext = React.createContext<LockGradesDockValue | null>(null);

export function useLockGradesDock(): LockGradesDockValue {
  const ctx = React.useContext(LockGradesDockContext);
  if (!ctx) throw new Error("useLockGradesDock must be used inside LockGradesDockProvider");
  return ctx;
}

/**
 * Lock grades now reports into the single shared Dock.
 * Local job state is kept so the Lock button flow keeps working,
 * but no separate panel is rendered anymore.
 */
export function LockGradesDockProvider({ children }: { children: React.ReactNode }) {
  const dock = useDock();
  const dockRef = React.useRef(dock);
  React.useEffect(() => {
    dockRef.current = dock;
  }, [dock]);
  const [job, setJob] = React.useState<LockJob | null>(null);
  const taskIdRef = React.useRef<string | null>(null);

  const startLock = React.useCallback((input: { subjectLabel: string; termLabel: string; total: number }) => {
    setJob({
      phase: "locking",
      subjectLabel: input.subjectLabel,
      termLabel: input.termLabel,
      locked: 0,
      total: input.total,
      message: null,
    });
    try {
      taskIdRef.current = dockRef.current.startTask({
        kind: "lock-grades",
        title: "Locking grades",
        description: `${input.subjectLabel} · ${input.total} grade${input.total === 1 ? "" : "s"}`,
        total: input.total,
      });
    } catch {
      taskIdRef.current = null;
    }
  }, []);

  const finishLock = React.useCallback(
    (ok: boolean, input: { locked: number; total: number; message?: string }) => {
      setJob((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          phase: ok ? "done" : "error",
          locked: input.locked,
          total: input.total,
          message: input.message ?? null,
        };
      });
      const id = taskIdRef.current;
      taskIdRef.current = null;
      try {
        const d = dockRef.current;
        const targetId =
          id ?? d.tasks.filter((t) => t.kind === "lock-grades" && t.status === "running").sort((a, b) => b.createdAt - a.createdAt)[0]?.id;
        if (!targetId) return;
        if (ok) {
          d.updateTask(targetId, {
            title: "Grades locked",
            description: `${input.locked} of ${input.total} locked · waiting for adviser approval`,
            progress: { done: input.total, total: input.total },
          });
          d.completeTask(targetId);
        } else {
          d.failTask(targetId, input.message ?? "Could not lock grades.");
        }
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const dismiss = React.useCallback(() => {
    setJob((prev) => {
      if (prev?.phase === "locking") return prev;
      return null;
    });
    try {
      for (const t of dockRef.current.tasks) {
        if (t.kind === "lock-grades" && t.status !== "running" && t.status !== "waiting") {
          dockRef.current.dismissTask(t.id);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const value = React.useMemo(() => ({ job, startLock, finishLock, dismiss }), [job, startLock, finishLock, dismiss]);

  return <LockGradesDockContext.Provider value={value}>{children}</LockGradesDockContext.Provider>;
}
