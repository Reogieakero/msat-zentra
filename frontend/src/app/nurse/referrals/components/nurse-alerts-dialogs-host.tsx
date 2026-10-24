"use client";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
import type { NurseQueueRow, NurseSessionItem } from "@/services/nurse/nurse.types";
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
import { NurseAdmReferralFormSheet } from "./NurseAdmReferralFormSheet";
import {
  CancelSessionDialog,
  DeleteSessionDialog,
  FinishSessionDialog,
  MoveSessionDialog,
  ScheduleSessionDialog,
} from "./NurseSessionDialogs";
import { NurseReferralFormViewModal } from "./NurseCaseDialogs";
import { SessionDocsDialog } from "./SessionDocsDialog";
import type { SessionDialogKind } from "./NurseReferralEntry";
export function NurseAlertsDialogsHost({
  previewId,
  onPreviewClose,
  privacyFor,
  onPrivacyClose,
  endorsedFor,
  onEndorsedClose,
  scheduleFor,
  onScheduleClose,
  onChanged,
  sessionDialog,
  onSessionClose,
  onSessionConfirmed,
  docsFor,
  onDocsClose,
  formSheet,
  onFormSheetClose,
  effectiveViewFor,
  onViewClose,
}: {
  previewId: string | null;
  onPreviewClose: () => void;
  privacyFor: string | null;
  onPrivacyClose: () => void;
  endorsedFor: string | null;
  onEndorsedClose: () => void;
  scheduleFor: NurseQueueRow | null;
  onScheduleClose: () => void;
  onChanged: () => void;
  sessionDialog: { row: NurseQueueRow; session: NurseSessionItem; kind: SessionDialogKind } | null;
  onSessionClose: () => void;
  /** Fired the moment a move/cancel is confirmed — the page closes the
      Clinic sessions board too and the Dock reports the outcome. */
  onSessionConfirmed: () => void;
  docsFor: { row: NurseQueueRow; session: NurseSessionItem } | null;
  onDocsClose: () => void;
  formSheet: { row: NurseQueueRow; draft: AdmReviewDraft } | null;
  onFormSheetClose: () => void;
  effectiveViewFor: NurseQueueRow | null;
  onViewClose: () => void;
}) {
  return (
    <>
      <OcForm01PreviewDialog recordId={previewId} onClose={onPreviewClose} />
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
      {scheduleFor && (
        <ScheduleSessionDialog
          row={scheduleFor}
          open
          onClose={onScheduleClose}
          onChanged={onChanged}
        />
      )}
      {sessionDialog && sessionDialog.kind === "finish" && (
        <FinishSessionDialog
          referralId={sessionDialog.row.id}
          session={sessionDialog.session}
          open
          onClose={onSessionClose}
          onConfirmed={onSessionConfirmed}
          onChanged={onChanged}
        />
      )}
      {sessionDialog && sessionDialog.kind === "move" && (
        <MoveSessionDialog
          referralId={sessionDialog.row.id}
          session={sessionDialog.session}
          student={sessionDialog.row.student}
          open
          onClose={onSessionClose}
          onConfirmed={onSessionConfirmed}
          onChanged={onChanged}
        />
      )}
      {sessionDialog && sessionDialog.kind === "cancel" && (
        <CancelSessionDialog
          referralId={sessionDialog.row.id}
          session={sessionDialog.session}
          student={sessionDialog.row.student}
          open
          onClose={onSessionClose}
          onConfirmed={onSessionConfirmed}
          onChanged={onChanged}
        />
      )}
      {sessionDialog && sessionDialog.kind === "delete" && (
        <DeleteSessionDialog
          referralId={sessionDialog.row.id}
          session={sessionDialog.session}
          open
          onClose={onSessionClose}
          onChanged={onChanged}
        />
      )}
      {docsFor && (
        <SessionDocsDialog
          referralId={docsFor.row.id}
          session={docsFor.session}
          open
          onClose={onDocsClose}
          onConfirmed={onSessionConfirmed}
          onChanged={onChanged}
        />
      )}
      {formSheet && (
        <NurseAdmReferralFormSheet
          open
          onClose={onFormSheetClose}
          row={formSheet.row}
          initialDraft={formSheet.draft}
          onChanged={onChanged}
        />
      )}
      {effectiveViewFor && (
        <NurseReferralFormViewModal
          key={effectiveViewFor.id}
          row={effectiveViewFor}
          open
          onClose={onViewClose}
          onChanged={onChanged}
        />
      )}
    </>
  );
}
