"use client";

export type CaseStepId =
  | "referral"
  | "anecdotal"
  | "meetings"
  | "evidence"
  | "certify";

export interface CaseStepDef {
  id: CaseStepId;
  label: string;
  short: string;
  what: string;
  why: string;
  action: string;
}

export const CASE_STEPS: CaseStepDef[] = [
  {
    id: "referral",
    label: "1 · Referral",
    short: "Referral",
    what: "Check who referred the learner and read the GC Form 03 referral form.",
    why: "The referral starts the evidence chain — without it the case cannot be certified eligible.",
    action: "Open the GC Form 03 folder to review the filed referral.",
  },
  {
    id: "anecdotal",
    label: "2 · Anecdotal",
    short: "Anecdotal",
    what: "Review the adviser's anecdotal report (GCForm-01) and its recommendations.",
    why: "The anecdotal write-up is the second required evidence for eligibility.",
    action: "Click the folder to preview the anecdotal report.",
  },
  {
    id: "meetings",
    label: "3 · Meetings",
    short: "Meetings",
    what: "Log the parent meeting outcome — attended (minutes + logbook) or no-show (rebook as home visit).",
    why: "Parent engagement is required: an attended meeting, or a home-visitation form when parents do not attend.",
    action: "Open See attendance log, then answer Yes / No to record the outcome.",
  },
  {
    id: "evidence",
    label: "4 · Evidence",
    short: "Evidence",
    what: "Confirm every collected form in the evidence chain and open See details per row.",
    why: "Eligibility is derived from this checklist — it cannot be typed manually.",
    action: "Work through the list one by one; missing rows tell you what to collect next.",
  },
  {
    id: "certify",
    label: "5 · Certify",
    short: "Certify",
    what: "Write the ADM recommendation and create the certification.",
    why: "Certifying with complete evidence flips the case to Eligible and endorses it to the Principal.",
    action: "Press Continue to certification, write at least 10 characters, then Create certification.",
  },
];

export function stepIndex(id: CaseStepId): number {
  return CASE_STEPS.findIndex((s) => s.id === id);
}
