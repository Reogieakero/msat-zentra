"use client";
import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/coordinatorChannel";
import { apiErrorMessage } from "@/lib/api/errors";
import { stageLabel } from "@/services/coordinator/labels";
import type { AdmCaseRow } from "@/services/coordinator/coordinator.types";
import { useTerm } from "@/lib/term/TermContext";
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
  const { activeTerm } = useTerm();
  const termId = activeTerm?.termId ?? "";
  const advanceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/api/adm/${id}/stage`, {
        stage: "meeting_parents",
      });
      return data;
    },
    onSuccess: (data, id) => {
      void data;
      markSelfNotified(id);
      invalidateAll();
      setForwardTarget(null);
      setAdvanceTarget(null);
      opts?.onCaseClosed?.();
      toast.success({
        title: "Case advanced",
        description: `Case moved to ${stageLabel("meeting_parents")}.`,
      });
    },
    onError: (err) =>
      toast.error({
        title: "Could not update case",
        description: apiErrorMessage(err),
      }),
  });
  const forwardMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/api/adm/${id}/stage`, {
        stage: "principal_approval",
      });
      return data;
    },
    onSuccess: (data, id) => {
      void data;
      markSelfNotified(id);
      invalidateAll();
      setForwardTarget(null);
      setAdvanceTarget(null);
      opts?.onCaseClosed?.();
      toast.success({
        title: "Endorsed to Principal",
        description: "The case is now locked awaiting the Principal's signature.",
      });
    },
    onError: (err) =>
      toast.error({
        title: "Could not update case",
        description: apiErrorMessage(err),
      }),
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
    mutationFn: async () => {
      if (!createTarget) throw new Error("No referral selected.");
      const referralId = createTarget.id.replace(/^referral:/, "");
      const { data } = await apiClient.post("/api/adm/profiles", {
        ...(createTarget.studentId
          ? { studentId: createTarget.studentId }
          : {}),
        referralId,
        termId,
      });
      return data;
    },
    onSuccess: (data) => {
      const newId =
        typeof (data as { id?: unknown })?.id === "string"
          ? (data as { id: string }).id
          : null;
      if (newId) markSelfNotified(newId);
      invalidateAll();
      setCreateTarget(null);
      toast.success({
        title: "Learner profile created",
        description: "The case is now ready for the parent meeting.",
      });
    },
    onError: (err) =>
      toast.error({
        title: "Could not create profile",
        description: apiErrorMessage(err),
      }),
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
    termId,
    advancePending: advanceMutation.isPending,
    forwardPending: forwardMutation.isPending,
    confirmAdvance: () => {
      if (advanceTarget && !isEarlyRow(advanceTarget) && !advanceMutation.isPending) {
        advanceMutation.mutate(advanceTarget.id);
      }
    },
    confirmForward: () => {
      if (forwardTarget && !isEarlyRow(forwardTarget) && !forwardMutation.isPending) {
        forwardMutation.mutate(forwardTarget.id);
      }
    },
    createPending: createMutation.isPending,
    canCreate: Boolean(termId) && !createMutation.isPending,
    confirmCreate: () => {
      if (!createMutation.isPending) createMutation.mutate();
    },
  };
}
