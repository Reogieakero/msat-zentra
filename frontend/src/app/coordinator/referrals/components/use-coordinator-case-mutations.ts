"use client";
import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
import { markSelfNotified } from "@/lib/realtime/coordinatorChannel";
import { apiErrorMessage } from "@/lib/api/errors";
import { stageLabel } from "@/services/coordinator/labels";
import type { AdmCaseRow } from "@/services/coordinator/coordinator.types";
function isEarlyRow(row: AdmCaseRow): boolean {
  return row.id.startsWith("referral:");
}
export function useCoordinatorCaseMutations(
  invalidateAll: () => void,
  opts?: { onCaseClosed?: () => void },
) {
  const [forwardTarget, setForwardTarget] = React.useState<AdmCaseRow | null>(
    null,
  );
  const [advanceTarget, setAdvanceTarget] = React.useState<AdmCaseRow | null>(
    null,
  );
  const [createTarget, setCreateTarget] = React.useState<AdmCaseRow | null>(
    null,
  );
  const [prepareCreatePending, setPrepareCreatePending] =
    React.useState(false);
  const dock = useDock();
  const advanceMutation = useMutation({
    mutationFn: async ({ id }: { id: string; taskId: string | null }) => {
      const { data } = await apiClient.patch(`/api/adm/${id}/stage`, {
        stage: "meeting_parents",
      });
      return data;
    },
    onSuccess: (data, vars) => {
      void data;
      markSelfNotified(vars.id);
      invalidateAll();
      setForwardTarget(null);
      setAdvanceTarget(null);
      opts?.onCaseClosed?.();
      if (vars.taskId) {
        dock.completeTask(vars.taskId, `Moved to ${stageLabel("meeting_parents")}`);
      }
      toast.success({
        title: "Case advanced",
        description: `Case moved to ${stageLabel("meeting_parents")}.`,
      });
    },
    onError: (err, vars) => {
      if (vars?.taskId) dock.failTask(vars.taskId, apiErrorMessage(err));
      toast.error({
        title: "Could not update case",
        description: apiErrorMessage(err),
      });
    },
  });
  const forwardMutation = useMutation({
    mutationFn: async ({
      id,
    }: {
      id: string;
      student: string;
      taskId: string | null;
    }) => {
      const { data } = await apiClient.patch(`/api/adm/${id}/stage`, {
        stage: "principal_approval",
      });
      return data;
    },
    onSuccess: (data, vars) => {
      void data;
      markSelfNotified(vars.id);
      invalidateAll();
      setAdvanceTarget(null);
      opts?.onCaseClosed?.();
      if (vars.taskId) {
        dock.completeTask(vars.taskId, `${vars.student} → Principal`);
      }
    },
    onError: (err, vars) => {
      if (vars.taskId) dock.failTask(vars.taskId, apiErrorMessage(err));
      toast.error({
        title: "Could not update case",
        description: apiErrorMessage(err),
      });
    },
  });
  async function prepareCreate(row: AdmCaseRow) {
    if (prepareCreatePending) return;
    setPrepareCreatePending(true);
    try {
      const referralId = row.id.replace(/^referral:/, "");
      const caseRes = await apiClient.get(
        `/api/adm/case/${encodeURIComponent(`referral:${referralId}`)}`,
      );
      if (!caseRes.data) {
        toast.error({
          title: "Referral not found",
          description: "This referral no longer exists. Refresh the list.",
        });
        return;
      }
      setCreateTarget({ ...row, studentId: "" });
    } catch (err) {
      toast.error({
        title: "Could not start profile",
        description: apiErrorMessage(err),
      });
    } finally {
      setPrepareCreatePending(false);
    }
  }
  const createMutation = useMutation({
    mutationFn: async ({
      target,
    }: {
      target: AdmCaseRow;
      taskId: string | null;
    }) => {
      const referralId = target.id.replace(/^referral:/, "");
      const { data } = await apiClient.post("/api/adm/profiles", {
        ...(target.studentId ? { studentId: target.studentId } : {}),
        referralId,
      });
      return data;
    },
    onSuccess: (data, vars) => {
      const newId =
        typeof (data as { id?: unknown })?.id === "string"
          ? (data as { id: string }).id
          : null;
      if (newId) markSelfNotified(newId);
      invalidateAll();
      setCreateTarget(null);
      if (vars.taskId) {
        dock.completeTask(vars.taskId, `${vars.target.student} → profile`);
      }
    },
    onError: (err, vars) => {
      if (vars.taskId) dock.failTask(vars.taskId, apiErrorMessage(err));
      toast.error({
        title: "Could not create profile",
        description: apiErrorMessage(err),
      });
    },
  });
  return {
    forwardTarget,
    setForwardTarget,
    advanceTarget,
    setAdvanceTarget,
    createTarget,
    setCreateTarget,
    prepareCreate,
    prepareCreatePending,
    advancePending: advanceMutation.isPending,
    forwardPending: forwardMutation.isPending,
    confirmAdvance: () => {
      const target = advanceTarget;
      if (!target || isEarlyRow(target) || advanceMutation.isPending) return;
      // Close at once — the shared Dock reports the request until it settles.
      setAdvanceTarget(null);
      let taskId: string | null = null;
      try {
        taskId = dock.startTask({
          kind: "generic",
          title: "Advancing case",
          description: `${target.student} → ${stageLabel("meeting_parents")}`,
        });
      } catch {
        taskId = null;
      }
      advanceMutation.mutate({ id: target.id, taskId });
    },
    confirmForward: () => {
      const target = forwardTarget;
      if (!target || isEarlyRow(target) || forwardMutation.isPending) return;
      // Close at once — the shared Dock reports the request until it settles.
      setForwardTarget(null);
      let taskId: string | null = null;
      try {
        taskId = dock.startTask({
          kind: "adm-endorse",
          title: "Endorsing to Principal",
          description: `${target.student} → Principal`,
        });
      } catch {
        taskId = null;
      }
      forwardMutation.mutate({
        id: target.id,
        student: target.student,
        taskId,
      });
    },
    createPending: createMutation.isPending,
    canCreate: !createMutation.isPending,
    confirmCreate: () => {
      const target = createTarget;
      if (!target || createMutation.isPending) return;
      // Close at once — the shared Dock reports the request until it settles.
      setCreateTarget(null);
      let taskId: string | null = null;
      try {
        taskId = dock.startTask({
          kind: "generic",
          title: "Creating learner profile",
          description: `${target.student} → profile`,
        });
      } catch {
        taskId = null;
      }
      createMutation.mutate({ target, taskId });
    },
  };
}
