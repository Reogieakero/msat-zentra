"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sileo } from "@/components/ui/sonner";
import {
  lockBatchGrades,
  lockErrorMessage,
  useRefreshAcademic,
} from "@/services/teacher/grading.service";
import { markSelfNotified } from "@/lib/realtime/teacherChannel";
import { LockGradesModal } from "./LockGradesModal";
import { useLockGradesDock } from "@/components/shared/lock-grades/lock-grades-dock-context";

type Props = {
  assignmentId: string;
  subjectLabel: string;
  termLabel: string;
  unlockCount: number;
  variant?: "default" | "outline";
  size?: "sm" | "xs" | "default";
  className?: string;
};

function cleanAssignmentId(raw: string): string {
  try {
    return raw.includes("%") ? decodeURIComponent(raw) : raw;
  } catch {
    return raw;
  }
}

export function LockGradesButton({ assignmentId, subjectLabel, termLabel, unlockCount, variant = "default", size = "sm", className }: Props) {
  const cleanId = React.useMemo(() => cleanAssignmentId(assignmentId), [assignmentId]);
  const queryClient = useQueryClient();
  const refreshAcademic = useRefreshAcademic();
  const lockDock = useLockGradesDock();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refreshAll = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["teacher-grading-class"] });
    queryClient.invalidateQueries({ queryKey: ["registrar-final-grades"] });
    queryClient.invalidateQueries({ queryKey: ["record-keeper-final-grades"] });
    queryClient.invalidateQueries({ queryKey: ["teacher-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["registrar-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["record-keeper-notifications"] });
    refreshAcademic();
  }, [queryClient, refreshAcademic]);

  const handleConfirm = async (code: string) => {
    if (pending) return;
    setPending(true);
    setError(null);
    // Low latency: show the persistent bottom-right dock instantly (same
    // shell as the adviser-access check dock) so progress survives page
    // navigation, then flip unlockable rows optimistically.
    lockDock.startLock({ subjectLabel, termLabel, total: unlockCount });
    try {
      // Optimistic: flip unlockable rows to locked instantly.
      queryClient.setQueriesData<{ students?: { final?: { lockStatus?: string; computedAverage?: number | null } }[] }>(
        { queryKey: ["teacher-grading-class"] },
        (old) => {
          if (!old || !Array.isArray(old.students)) return old;
          return {
            ...old,
            students: old.students.map((s) =>
              s.final && s.final.lockStatus === "unlocked" && s.final.computedAverage != null
                ? { ...s, final: { ...s.final, lockStatus: "locked" } }
                : s,
            ),
          };
        },
      );
      const res = await lockBatchGrades(cleanId, code);
      markSelfNotified(cleanId);
      setOpen(false);
      refreshAll();
      lockDock.finishLock(true, { locked: res.locked, total: unlockCount });
      const shortSubject = subjectLabel.split(" (")[0] ?? subjectLabel;
      const unit = res.locked === 1 ? "grade" : "grades";
      sileo.success({
        title: `${shortSubject} grades locked`,
        description: `You locked ${res.locked} ${unit} for ${subjectLabel}, ${termLabel}. They are now waiting for adviser approval.`,
      });
    } catch (err) {
      // Roll back optimistic flip.
      queryClient.invalidateQueries({ queryKey: ["teacher-grading-class"] });
      const message = lockErrorMessage(err);
      setError(message);
      lockDock.finishLock(false, { locked: 0, total: unlockCount, message });
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size === "xs" ? "sm" : size}
        className={className}
        disabled={unlockCount === 0 || pending}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Lock aria-hidden />
        Lock grades{unlockCount > 0 ? ` (${unlockCount})` : ""}
      </Button>
      {open ? (
        <LockGradesModal
          open={open}
          subjectLabel={subjectLabel}
          unlockCount={unlockCount}
          pending={pending}
          error={error}
          onClose={() => {
            if (!pending) setOpen(false);
          }}
          onConfirm={(code) => void handleConfirm(code)}
        />
      ) : null}
    </>
  );
}
