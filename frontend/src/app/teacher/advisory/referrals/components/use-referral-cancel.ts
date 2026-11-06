"use client";
import * as React from "react";
import { apiClient } from "@/lib/api/client";
import { sileo } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
import { markSelfNotified } from "@/lib/realtime/teacherChannel";
import { useTeacherInvalidate } from "../../../components/use-teacher-invalidate";
import type { ReferralActionTarget } from "./ReferralActionDialogs";
import type { ReferralRow } from "./use-my-referrals";
export function useReferralCancel() {
  const invalidateTeacher = useTeacherInvalidate();
  const dock = useDock();
  const dockRef = React.useRef(dock);
  React.useEffect(() => {
    dockRef.current = dock;
  }, [dock]);
  const [cancelTarget, setCancelTarget] = React.useState<ReferralActionTarget | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelPending, setCancelPending] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  // Last successfully withdrawn student: keeps the bottom-right dock
  // visible (done state) until the teacher dismisses it.
  const [settleName, setSettleName] = React.useState<string | null>(null);
  const requestCancel = React.useCallback((row: ReferralRow) => {
    setCancelTarget({ id: row.id, studentName: row.studentName });
    setCancelReason("");
    setActionError(null);
    setSettleName(null);
  }, []);
  async function confirmCancel(): Promise<void> {
    if (!cancelTarget || cancelReason.trim() === "" || cancelPending) return;
    setCancelPending(true);
    setActionError(null);
    const studentName = cancelTarget.studentName;
    let taskId: string | null = null;
    try {
      taskId = dockRef.current.startTask({ kind: "referral-cancel", title: "Cancelling referral", description: `Withdrawing ${studentName}…` });
    } catch {
      taskId = null;
    }
    try {
      const { data } = await apiClient.post<{ id: string }>(`/api/referrals/${cancelTarget.id}/cancel`, {
        reason: cancelReason.trim(),
      });
      if (data?.id) markSelfNotified(data.id);
      invalidateTeacher.referrals();
      setCancelTarget(null);
      setCancelReason("");
      setSettleName(cancelTarget.studentName);
      try {
        if (taskId) dockRef.current.completeTask(taskId, `${studentName} withdrawn`);
      } catch {
        /* ignore */
      }
      sileo.success({ title: "Referral cancelled", description: "The case was withdrawn." });
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Could not cancel this referral.";
      try {
        if (taskId) dockRef.current.failTask(taskId, message);
      } catch {
        /* ignore */
      }
      setActionError(message);
      sileo.error({ title: "Could not cancel referral", description: message });
    } finally {
      setCancelPending(false);
    }
  }
  return {
    invalidateTeacher,
    cancelTarget,
    setCancelTarget,
    cancelReason,
    setCancelReason,
    cancelPending,
    actionError,
    setActionError,
    settleName,
    dismissSettle: () => setSettleName(null),
    requestCancel,
    confirmCancel,
  };
}
