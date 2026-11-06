"use client";

import { useQuery } from "@tanstack/react-query";
import { useDock } from "@/components/dock/dock-store";
import {
  AdmReferralFormSheet,
  type AdmReferralFormDraft,
} from "@/components/adm-referral-form/AdmReferralFormPage";
import type { GuidanceAdmCase } from "@/services/guidance/adm.types";
import { listAdmConsultationSessions, reviewAdmConsultation } from "@/services/guidance/adm.service";
import { markSelfNotified } from "@/lib/realtime/guidanceChannel";
import { useGuidanceInvalidate } from "../../overview/components/use-guidance-mutation";
import type { GcForm03Data } from "@/services/guidance/gcform03.types";

export function GuidanceAdmReferralFormSheet({
  open,
  onClose,
  adapter,
  anecdotalId,
  lrn,
  initialDraft,
  counselorName = "",
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  adapter: GuidanceAdmCase;
  anecdotalId: string | null;
  lrn: string;
  initialDraft: AdmReferralFormDraft;
  counselorName?: string;
  onChanged: () => void;
}) {
  const invalidateGuidance = useGuidanceInvalidate();
  const dock = useDock();
  const referralId = adapter.referralId;

  const sessionsQuery = useQuery({
    queryKey: ["adm-consultation-sessions", referralId],
    queryFn: () => listAdmConsultationSessions(referralId),
    enabled: open,
  });
  const hasActiveSession = (sessionsQuery.data ?? []).some((s) => s.status === "scheduled");

  async function onConfirm({ form }: { form: GcForm03Data; scheduledAt?: string }) {
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "adm-endorse",
        title: "Endorsing to ADM",
        description: "Saving the referral form and endorsement.",
      });
    } catch {
      taskId = null;
    }
    try {
      await reviewAdmConsultation(referralId, {
        recommendation: form.guidanceRecommendations.trim() || "Referred for ADM.",
        outcome: "endorse",
      });
    } catch (error) {
      if (taskId) dock.failTask(taskId, "Could not endorse this case.");
      throw error;
    }
    if (taskId) dock.completeTask(taskId, "Case endorsed.");
  }

  function onConfirmed() {

    markSelfNotified(referralId);
    invalidateGuidance();
    onChanged();
    onClose();
  }

  return (
    <AdmReferralFormSheet
      open={open}
      onClose={onClose}
      referralId={referralId}
      backLabel="Close"
      staffSectionTitle="Guidance counselor section"
      signerLabel="Guidance Counselor / Career Advocate"
      showClinicSession={false}
      counselorName={counselorName}
      casePending={false}
      caseError={false}
      activeCase={{ adapter, anecdotalId, hasActiveSession, lrn }}
      unavailableMessage={null}
      initialDraft={initialDraft}
      confirmToastDescription="The case was endorsed to the ADM coordinator."
      onConfirm={onConfirm}
      onConfirmed={onConfirmed}
    />
  );
}
