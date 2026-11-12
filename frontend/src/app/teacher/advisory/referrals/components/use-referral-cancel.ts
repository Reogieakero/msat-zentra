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
  // Tracked per referral id: the dialog closes as soon as the request starts, so
  // a shared boolean would leak "Cancelling…" onto the next dialog the teacher
  // opens while the first request is still in flight.
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const cancelPending =
    pendingId !== null && cancelTarget !== null && pendingId === cancelTarget.id;
  // Same-id guard: the dialog unmounts before the POST settles, so a double
  // click / double Enter must not fire two cancels.
  const inFlight = React.useRef<Set<string>>(new Set());
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
    const { id: referralId, studentName } = cancelTarget;
    if (inFlight.current.has(referralId)) return;
    inFlight.current.add(referralId);
    const reason = cancelReason.trim();
    setPendingId(referralId);
    setActionError(null);
    let taskId: string | null = null;
    try {
      taskId = dockRef.current.startTask({ kind: "referral-cancel", title: "Cancelling referral", description: `Withdrawing ${studentName}…` });
    } catch {
      taskId = null;
    }
    // Close the dialog the moment the request starts. The POST can take several
    // seconds on a slow DB link, and the bottom-right dock already tracks it —
    // waiting on the roundtrip left the dialog stuck on "Cancelling…".
    setCancelTarget(null);
    setCancelReason("");
    let cancelledId: string | null = null;
    try {
      const { data } = await apiClient.post<{ id: string }>(`/api/referrals/${referralId}/cancel`, {
        reason,
      });
      cancelledId = data?.id ?? null;
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
      // The server state is the truth after a rejection (the case may have moved
      // on while the dialog was open), so re-read the board.
      invalidateTeacher.referrals();
      setPendingId(null);
      inFlight.current.delete(referralId);
      return;
    }
    setPendingId(null);
    inFlight.current.delete(referralId);
    setSettleName(studentName);
    if (cancelledId) markSelfNotified(cancelledId);
    invalidateTeacher.referrals();
    try {
      if (taskId) dockRef.current.completeTask(taskId, `${studentName} withdrawn`);
    } catch {
      /* ignore */
    }
    sileo.success({ title: "Referral cancelled", description: "The case was withdrawn." });
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
