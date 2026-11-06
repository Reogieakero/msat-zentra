"use client";
import { GuidanceSessionDialogs } from "./GuidanceSessionDialogs";
import { EscalateDialog } from "./guidance-escalate-dialog";
import { ReassignDialog } from "./guidance-reassign-dialog";
import { NoteDialog } from "./guidance-note-dialog";
import { FollowUpDialog } from "./guidance-follow-up-dialog";
import { DismissDialog } from "./guidance-dismiss-dialog";
import { SpecialistDialog } from "./guidance-specialist-dialog";
import { AdmDialog } from "./guidance-adm-dialog";
import { AcceptDialog } from "./guidance-accept-dialog";
import { ResolveDialog } from "./guidance-resolve-dialog";
import type { GuidanceDialogProps } from "./guidance-dialog-props";
export type {
  GuidanceActionDialogs,
  GuidanceDialogKey,
  GuidanceActionFormState,
} from "./guidance-dialog-props";
export { INITIAL_GUIDANCE_FORM } from "./guidance-dialog-props";
export function GuidanceReferralDialogs(props: GuidanceDialogProps) {
  const { dialogs, activeRow, activeSession, isActionPending, closeDialog, handleAction } = props;
  return (
    <>
      <EscalateDialog {...props} />
      <ReassignDialog {...props} />
      <NoteDialog {...props} />
      <FollowUpDialog {...props} />
      <DismissDialog {...props} />
      <SpecialistDialog {...props} />
      <AdmDialog {...props} />
      <AcceptDialog {...props} />
      <GuidanceSessionDialogs
        dialogs={dialogs}
        activeRow={activeRow}
        activeSession={activeSession}
        isActionPending={isActionPending}
        closeDialog={closeDialog}
        handleAction={handleAction}
      />
      <ResolveDialog {...props} />
    </>
  );
}
