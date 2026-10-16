"use client";

import * as React from "react";
import { useDock } from "@/components/dock/dock-store";
import type { ReferralSubmitSnapshot } from "@/app/teacher/advisory/referrals/components/refer-form";

export type ReferralSubmitJob =
  | ({ phase: "sending" | "done" } & ReferralSubmitSnapshot)
  | ({ phase: "error"; message: string } & ReferralSubmitSnapshot);

interface TeacherSubmitDockValue {
  job: ReferralSubmitJob | null;
  startSubmit: (snap: ReferralSubmitSnapshot) => void;
  finishSubmit: (ok: boolean, snap: ReferralSubmitSnapshot & { message?: string }) => void;
  dismissSubmit: () => void;
}

const TeacherSubmitDockContext = React.createContext<TeacherSubmitDockValue | null>(null);

export function useReferralSubmitDock(): TeacherSubmitDockValue {
  const ctx = React.useContext(TeacherSubmitDockContext);
  if (!ctx) {
    throw new Error("useReferralSubmitDock must be used within TeacherSubmitDockProvider");
  }
  return ctx;
}

/**
 * Referral send now reports into the single shared Dock.
 * The old separate panel is gone; jobs stay until the teacher
 * dismisses them, survive page jumps, new tabs and refresh.
 */
export function TeacherSubmitDockProvider({ children }: { children: React.ReactNode }) {
  const dock = useDock();
  const dockRef = React.useRef(dock);
  React.useEffect(() => {
    dockRef.current = dock;
  }, [dock]);
  const [job, setJob] = React.useState<ReferralSubmitJob | null>(null);
  const taskIdRef = React.useRef<string | null>(null);

  const startSubmit = React.useCallback((snap: ReferralSubmitSnapshot) => {
    setJob({ phase: "sending", ...snap });
    try {
      taskIdRef.current = dockRef.current.startTask({
        kind: "referral-send",
        title: "Sending referral",
        description: `${snap.studentName} → ${snap.shortDeskLabel}`,
      });
    } catch {
      taskIdRef.current = null;
    }
  }, []);

  const finishSubmit = React.useCallback(
    (ok: boolean, snap: ReferralSubmitSnapshot & { message?: string }) => {
      setJob(
        ok
          ? {
              phase: "done",
              studentName: snap.studentName,
              deskLabel: snap.deskLabel,
              shortDeskLabel: snap.shortDeskLabel,
            }
          : {
              phase: "error",
              studentName: snap.studentName,
              deskLabel: snap.deskLabel,
              shortDeskLabel: snap.shortDeskLabel,
              message: snap.message ?? "Could not submit this referral.",
            },
      );
      const id = taskIdRef.current;
      taskIdRef.current = null;
      try {
        if (id) {
          if (ok) {
            dockRef.current.completeTask(id, `${snap.studentName} → ${snap.shortDeskLabel}`);
          } else {
            dockRef.current.failTask(id, snap.message ?? "Could not submit this referral.");
          }
        } else {
          // Fallback: no tracked id (e.g. strict-mode remount). Update the
          // latest running referral task so the shared Dock still settles.
          const latest = dockRef.current.tasks
            .filter((t) => t.kind === "referral-send" && t.status === "running")
            .sort((a, b) => b.createdAt - a.createdAt)[0];
          if (latest) {
            if (ok) dockRef.current.completeTask(latest.id);
            else dockRef.current.failTask(latest.id, snap.message ?? "Could not submit this referral.");
          }
        }
      } catch {
        /* shared Dock unavailable in tests — keep local job only */
      }
    },
    [],
  );

  const dismissSubmit = React.useCallback(() => {
    setJob(null);
    try {
      for (const t of dockRef.current.tasks) {
        if (t.kind === "referral-send" && (t.status === "done" || t.status === "failed" || t.status === "cancelled")) {
          dockRef.current.dismissTask(t.id);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const value = React.useMemo(
    () => ({ job, startSubmit, finishSubmit, dismissSubmit }),
    [job, startSubmit, finishSubmit, dismissSubmit],
  );

  return <TeacherSubmitDockContext.Provider value={value}>{children}</TeacherSubmitDockContext.Provider>;
}
