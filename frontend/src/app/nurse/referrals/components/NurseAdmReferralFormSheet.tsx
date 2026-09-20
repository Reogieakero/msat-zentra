"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  AdmReferralFormSheet,
  type AdmReferralFormDraft,
} from "@/components/adm-referral-form/AdmReferralFormPage";
import { CONCERN_OPTIONS, type GcForm03Data } from "@/app/guidance/adm/components/gcform03-data";
import {
  confirmNurseReferralAndEndorse,
  type NurseAdmReferralForm,
  type NurseQueueRow,
} from "../../overview/components/nurse-overview-data";

/* Flatten the filled form into the internal note the coordinator receives
   with the endorsed case. */
function referralFormOf(f: GcForm03Data): NurseAdmReferralForm {
  const checked = CONCERN_OPTIONS.filter((c) => f.concerns[c.key]);
  const concerns = checked.map((c) =>
    c.key === "others" && f.concerns.othersText.trim()
      ? `Others: ${f.concerns.othersText.trim()}`
      : c.label
  );
  const actionBits = f.referrerActions
    .map((a) => [a.action.trim(), a.date.trim()].filter(Boolean).join(" "))
    .filter(Boolean);
  const nurseBits = [
    ...(f.referrerRecommendations.trim() ? [f.referrerRecommendations.trim()] : []),
    ...(actionBits.length > 0 ? [`Actions: ${actionBits.join("; ")}`] : []),
  ];
  return {
    ...(concerns.length > 0 ? { concerns } : {}),
    ...(f.detailsOfConcern.trim()
      ? { detailsOfConcern: f.detailsOfConcern.trim().slice(0, 2000) }
      : {}),
    ...(nurseBits.length > 0
      ? { nurseActions: nurseBits.join(" | ").slice(0, 2000) }
      : {}),
    ...(f.followUp.trim() ? { followUp: f.followUp.trim().slice(0, 2000) } : {}),
  };
}

/**
 * Nurse GCForm-03 fill-up sheet — shared fill-up UI opening in place on
 * the referrals page (no navigation), nurse wiring: confirming SAVES the
 * referral form AND endorses the case to the ADM coordinator at once,
 * pops a success toast, then closes back to the list.
 */
export function NurseAdmReferralFormSheet({
  open,
  onClose,
  row,
  initialDraft,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  row: NurseQueueRow;
  initialDraft: AdmReferralFormDraft;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const reviewable = row.type === "ADM" && row.status === "pending";

  async function onConfirm({
    form,
    scheduledAt,
  }: {
    form: GcForm03Data;
    scheduledAt?: string;
  }) {
    await confirmNurseReferralAndEndorse(row.id, {
      recommendation: form.guidanceRecommendations.trim() || "Referred for ADM.",
      ...(scheduledAt ? { scheduledAt } : {}),
      referralForm: referralFormOf(form),
    });
  }

  function onConfirmed() {
    queryClient.invalidateQueries({ queryKey: ["nurse-overview"] });
    queryClient.invalidateQueries({ queryKey: ["nurse-alerts"] });
    queryClient.invalidateQueries({ queryKey: ["nurse-risk"] });
    queryClient.invalidateQueries({ queryKey: ["nurse-risk-levels"] });
    onChanged();
    onClose();
  }

  return (
    <AdmReferralFormSheet
      open={open}
      onClose={onClose}
      referralId={row.id}
      backLabel="Close"
      staffSectionTitle="School nurse section"
      signerLabel="School Nurse"
      showClinicSession
      counselorName=""
      casePending={false}
      caseError={false}
      activeCase={
        reviewable
          ? {
              adapter: {
                id: row.id,
                student: row.student,
                lrn: row.lrn,
                section: row.section,
                grade: row.grade,
                stage: "consultation",
                stageLabel: "Consultation and referral",
                eligibility: "pending",
                referralId: row.id,
                referralStatus: row.status,
                reason: row.reason,
                referredBy: "",
                preparedBy: "",
                date: row.date,
                meetingAttended: null,
                hasHomeVisit: false,
                approved: false,
                approvedAt: null,
                anecdotalId: row.anecdotalId ?? undefined,
                category: row.category,
                anecdotalExcerpt: row.anecdotal?.incident ?? "",
                recommendations: row.anecdotal?.notes ?? "",
              },
              anecdotalId: row.anecdotalId,
              hasActiveSession: row.sessions.some((s) => s.status === "scheduled"),
              lrn: row.lrn,
            }
          : null
      }
      unavailableMessage={
        !reviewable
          ? "This case is no longer waiting for review — it may have been decided already."
          : null
      }
      initialDraft={initialDraft}
      confirmToastDescription="The case was endorsed to the ADM coordinator."
      onConfirm={onConfirm}
      onConfirmed={onConfirmed}
    />
  );
}
