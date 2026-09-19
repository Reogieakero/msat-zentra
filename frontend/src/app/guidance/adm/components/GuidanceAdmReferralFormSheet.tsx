"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AdmReferralFormSheet,
  type AdmReferralFormDraft,
} from "@/components/adm-referral-form/AdmReferralFormPage";
import type { GuidanceAdmCase } from "./guidance-adm-data";
import { listAdmConsultationSessions, reviewAdmConsultation } from "./guidance-adm-data";
import type { GcForm03Data } from "./gcform03-data";

/**
 * Guidance GCForm-03 fill-up sheet — shared fill-up UI opening in place
 * (no navigation), guidance wiring: confirming endorses the case to the
 * ADM coordinator, pops a success toast, then closes back to the list.
 */
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
  const queryClient = useQueryClient();
  const referralId = adapter.referralId;

  // Sessions already booked on the case — confirming is blocked while one
  // is still upcoming (same rule as the nurse desk).
  const sessionsQuery = useQuery({
    queryKey: ["adm-consultation-sessions", referralId],
    queryFn: () => listAdmConsultationSessions(referralId),
    enabled: open,
  });
  const hasActiveSession = (sessionsQuery.data ?? []).some((s) => s.status === "scheduled");

  async function onConfirm({ form }: { form: GcForm03Data; scheduledAt?: string }) {
    await reviewAdmConsultation(referralId, {
      recommendation: form.guidanceRecommendations.trim() || "Referred for ADM.",
      outcome: "endorse",
    });
  }

  function onConfirmed() {
    queryClient.invalidateQueries({ queryKey: ["guidance-adm"] });
    queryClient.invalidateQueries({ queryKey: ["guidance-referrals"] });
    queryClient.invalidateQueries({ queryKey: ["guidance-overview"] });
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
