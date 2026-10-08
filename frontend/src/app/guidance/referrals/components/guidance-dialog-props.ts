"use client";
import type {
  CounselingSessionItem,
  GuidanceReferralItem,
} from "@/services/guidance/guidance.types";
export interface GuidanceActionDialogs {
  escalate: boolean;
  reassign: boolean;
  note: boolean;
  followUp: boolean;
  dismiss: boolean;
  specialist: boolean;
  adm: boolean;
  accept: boolean;
  schedule: boolean;
  finish: boolean;
  move: boolean;
  cancelSess: boolean;
  deleteSess: boolean;
  resolve: boolean;
}
export type GuidanceDialogKey = keyof GuidanceActionDialogs;
export interface GuidanceActionFormState {
  escalationReason: string;
  escalatedTo: string;
  noteText: string;
  followUpDate: string;
  dismissReason: string;
  specialistRole: string;
  specialistReason: string;
  admReason: string;
  priority: string;
  intakeNotes: string;
  sessDate: string;
  sessTime: string;
  sessType: string;
  sessVenue: string;
  doneNotes: string;
  doneOutcome: string;
  cancelReasonInput: string;
  resolveSummary: string;
}
export const INITIAL_GUIDANCE_FORM: GuidanceActionFormState = {
  escalationReason: "",
  escalatedTo: "",
  noteText: "",
  followUpDate: "",
  dismissReason: "",
  specialistRole: "",
  specialistReason: "",
  admReason: "",
  priority: "normal",
  intakeNotes: "",
  sessDate: "",
  sessTime: "",
  sessType: "individual",
  sessVenue: "",
  doneNotes: "",
  doneOutcome: "",
  cancelReasonInput: "",
  resolveSummary: "",
};
export interface GuidanceDialogProps {
  dialogs: GuidanceActionDialogs;
  form: GuidanceActionFormState;
  setForm: React.Dispatch<React.SetStateAction<GuidanceActionFormState>>;
  activeRow: GuidanceReferralItem | null;
  activeSession: CounselingSessionItem | null;
  isActionPending: boolean;
  mutationIsPending: boolean;
  closeDialog: (dialog: GuidanceDialogKey) => void;
  handleAction: (action: string, payload: unknown) => void;
  onResolveCase: (id: string, summary: string) => void;
}
