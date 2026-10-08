"use client";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
import type { GuidanceReferralItem } from "@/services/guidance/guidance.types";
import { AdmReviewDialog } from "../../adm/components/AdmReviewDialog";
import { GuidanceAdmReferralFormSheet } from "../../adm/components/GuidanceAdmReferralFormSheet";
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
export function GuidanceReferralsDialogsHost({
  previewId,
  onPreviewClose,
  privacyFor,
  onPrivacyClose,
  endorsedFor,
  onEndorsedClose,
  reviewAdmFor,
  onReviewClose,
  onReviewChanged,
  onCreateReferral,
  formSheet,
  onFormSheetClose,
  onFormSheetChanged,
}: {
  previewId: string | null;
  onPreviewClose: () => void;
  privacyFor: string | null;
  onPrivacyClose: () => void;
  endorsedFor: string | null;
  onEndorsedClose: () => void;
  reviewAdmFor: GuidanceReferralItem | null;
  onReviewClose: () => void;
  onReviewChanged: () => void;
  onCreateReferral: (draft: AdmReviewDraft) => void;
  formSheet: { row: GuidanceReferralItem; draft: AdmReviewDraft } | null;
  onFormSheetClose: () => void;
  onFormSheetChanged: () => void;
}) {
  return (
    <>
      <OcForm01PreviewDialog
        recordId={previewId}
        onClose={onPreviewClose}
      />
      <PrivacyNoticeDialog
        open={privacyFor !== null}
        onClose={onPrivacyClose}
        studentName={privacyFor ?? undefined}
      />
      <PrivacyNoticeDialog
        open={endorsedFor !== null}
        onClose={onEndorsedClose}
        studentName={endorsedFor ?? undefined}
        reason="endorsed"
      />
      {reviewAdmFor && (
        <AdmReviewDialog
          referralId={reviewAdmFor.id}
          student={reviewAdmFor.student}
          anecdotalId={reviewAdmFor.anecdotalId || null}
          info={{
            lrn: reviewAdmFor.lrn,
            section: reviewAdmFor.section,
            grade: reviewAdmFor.grade,
            category: reviewAdmFor.category,
            date: reviewAdmFor.date,
          }}
          open
          onClose={onReviewClose}
          onChanged={onReviewChanged}
          onCreateReferral={onCreateReferral}
          mode="desk"
        />
      )}
      {formSheet && (
        <GuidanceAdmReferralFormSheet
          open
          onClose={onFormSheetClose}
          adapter={{
            id: formSheet.row.id,
            student: formSheet.row.student,
            lrn: formSheet.row.lrn,
            section: formSheet.row.section,
            grade: formSheet.row.grade,
            stage: "consultation",
            stageLabel: "Consultation and referral",
            eligibility: "pending",
            referralId: formSheet.row.id,
            referralStatus: formSheet.row.status,
            reason: formSheet.row.reason,
            referredBy: formSheet.row.referredBy,
            preparedBy: formSheet.row.referredBy,
            date: formSheet.row.date,
            meetingAttended: null,
            hasHomeVisit: false,
            approved: false,
            approvedAt: null,
            anecdotalId: formSheet.row.anecdotalId || undefined,
            category: formSheet.row.category,
            anecdotalExcerpt: formSheet.row.anecdotalExcerpt,
            recommendations: formSheet.row.recommendations,
          }}
          anecdotalId={formSheet.row.anecdotalId || null}
          lrn={formSheet.row.lrn}
          initialDraft={formSheet.draft}
          onChanged={onFormSheetChanged}
        />
      )}
    </>
  );
}
