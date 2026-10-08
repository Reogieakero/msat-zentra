export const ADM_STAGES: {
  stage: string;
  order: number;
  label: string;
  owner: string;
  principalAction: boolean;
  description: string;
}[] = [
  {
    stage: "anecdotal",
    order: 1,
    label: "Anecdotal Report Filed",
    owner: "Adviser",
    principalAction: false,
    description: "Anecdotal report documenting the learner's concern.",
  },
  {
    stage: "consultation",
    order: 2,
    label: "Consultation & Referral",
    owner: "Guidance / Nurse / LRPC",
    principalAction: false,
    description: "Reviewed by Guidance Counselor, School Nurse, or LRPC.",
  },
  {
    stage: "meeting_parents",
    order: 3,
    label: "Meeting with Parents/Guardians",
    owner: "ADM Coordinator & Teachers",
    principalAction: false,
    description: "Meeting with parents/guardians. Attended → minutes logged; otherwise → home visitation.",
  },
  {
    stage: "home_visitation",
    order: 4,
    label: "Home Visitation (if no meeting)",
    owner: "Guidance Counselor",
    principalAction: false,
    description: "Conducted only when parents did not attend the meeting.",
  },
  {
    stage: "certification",
    order: 5,
    label: "Recommendation & Certification",
    owner: "ADM Coordinator",
    principalAction: false,
    description: "ADM Coordinator records the recommendation and issues the certification.",
  },
  {
    stage: "principal_approval",
    order: 6,
    label: "School Head (Principal) Approval",
    owner: "Principal",
    principalAction: true,
    description: "Principal signs the certification and authorizes module release.",
  },
  {
    stage: "enrollment_monitoring",
    order: 7,
    label: "Modules Completed & Returned",
    owner: "Student",
    principalAction: false,
    description: "Student completes the modules; Coordinator / Teacher track progress.",
  },
  {
    stage: "completion",
    order: 8,
    label: "Case Closed",
    owner: "ADM Coordinator",
    principalAction: false,
    description: "Learner has returned and the ADM case is closed.",
  },
];
export const STAGE_LABELS: Record<string, string> = {
  anecdotal: "Anecdotal record filed",
  consultation: "Consultation & referral",
  meeting_parents: "Meeting with parents",
  home_visitation: "Home visitation",
  certification: "Recommendation & certification",
  principal_approval: "Principal approval",
  enrollment_monitoring: "Enrollment monitoring",
  completion: "Completion",
};
export const ADM_ORDER = [
  "anecdotal",
  "consultation",
  "meeting_parents",
  "home_visitation",
  "certification",
  "principal_approval",
  "enrollment_monitoring",
  "completion",
];
export const ADM_PIPELINE_META: {
  stage: string;
  order: number;
  label: string;
  owner: string;
  principalAction: boolean;
  description: string;
}[] = [
  {
    stage: "anecdotal",
    order: 1,
    label: "Anecdotal Report Filed",
    owner: "Adviser",
    principalAction: false,
    description: "Adviser files the anecdotal report documenting the learner's concern.",
  },
  {
    stage: "consultation",
    order: 2,
    label: "Consultation & Referral",
    owner: "Guidance / Nurse / LRPC",
    principalAction: false,
    description: "Routed to Guidance Counselor, School Nurse, or LRPC for review.",
  },
  {
    stage: "meeting_parents",
    order: 3,
    label: "Meeting with Parents/Guardians",
    owner: "ADM Coordinator & Teachers",
    principalAction: false,
    description: "Meeting with parents/guardians. Attended → minutes logged; otherwise → home visitation.",
  },
  {
    stage: "home_visitation",
    order: 4,
    label: "Home Visitation (if no meeting)",
    owner: "Guidance Counselor",
    principalAction: false,
    description: "Conducted only when parents did not attend the meeting. Both branches converge at certification.",
  },
  {
    stage: "certification",
    order: 5,
    label: "Recommendation & Certification",
    owner: "ADM Coordinator",
    principalAction: false,
    description: "ADM Coordinator records the recommendation and issues the ADM certification.",
  },
  {
    stage: "principal_approval",
    order: 6,
    label: "School Head (Principal) Approval",
    owner: "Principal",
    principalAction: true,
    description: "Principal signs the certification and authorizes module release and monitoring.",
  },
  {
    stage: "enrollment_monitoring",
    order: 7,
    label: "Modules Completed & Returned",
    owner: "Student",
    principalAction: false,
    description: "Student completes the modules; Coordinator / Teacher track progress.",
  },
  {
    stage: "completion",
    order: 8,
    label: "Case Closed",
    owner: "ADM Coordinator",
    principalAction: false,
    description: "Learner has returned and the ADM case is closed.",
  },
];
export const ELIGIBILITY_LABELS: Record<string, string> = {
  pending: "For review",
  eligible: "Eligible",
  ineligible: "Ineligible",
};
export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}
export function stageOrder(stage: string): number {
  return ADM_STAGES.find((s) => s.stage === stage)?.order ?? 2;
}
export function eligibilityLabel(e: string): string {
  return e === "eligible" ? "Eligible" : e === "ineligible" ? "Ineligible" : "For Review";
}
export function stageStatus(
  caseData: {
    meetingAttended: boolean | null;
    hasHomeVisit: boolean;
    certificationIssued: boolean;
    eligibilityStatus: string;
    approved: boolean;
    modulesSubmitted: number;
    modulesTotal: number;
    referralStatus: string;
  },
  stage: string
): string {
  switch (stage) {
    case "anecdotal":
      return "Filed";
    case "consultation":
      return "Referred";
    case "meeting_parents":
      return caseData.meetingAttended === null
        ? "If needed"
        : caseData.meetingAttended
          ? "Attended"
          : "Scheduled";
    case "home_visitation":
      return caseData.hasHomeVisit ? "Done" : "If no meeting";
    case "certification":
      return caseData.certificationIssued
        ? (ELIGIBILITY_LABELS[caseData.eligibilityStatus] ?? "Issued")
        : "Pending issuance";
    case "principal_approval":
      return caseData.approved ? "Signed" : "Pending signature";
    case "enrollment_monitoring":
      return `Modules ${caseData.modulesSubmitted}/${caseData.modulesTotal}`;
    case "completion":
      return caseData.referralStatus === "resolved" ? "Closed" : "Pending";
    default:
      return "";
  }
}
export function caseHeadline(caseData: {
  referralStatus: string;
  stage: string;
  meetingAttended: boolean | null;
  hasHomeVisit: boolean;
  certificationIssued: boolean;
  eligibilityStatus: string;
  approved: boolean;
  modulesSubmitted: number;
  modulesTotal: number;
}): string {
  if (caseData.referralStatus === "resolved" || caseData.stage === "completion") {
    return "Case closed — the ADM process is complete.";
  }
  switch (caseData.stage) {
    case "anecdotal":
      return "Anecdotal filed — referral is being prepared.";
    case "consultation":
      return "Referral submitted — now waiting for Guidance Counselor / Nurse / LRPC review.";
    case "meeting_parents":
      if (caseData.meetingAttended === true) {
        return "Consultation done — parent meeting attended, moving to Coordinator recommendation.";
      }
      if (caseData.meetingAttended === false) {
        return "Consultation done — parent meeting scheduled, waiting on the ADM Coordinator & Teachers.";
      }
      return "Consultation done — now waiting on the parent meeting.";
    case "home_visitation":
      if (caseData.hasHomeVisit) {
        return "Home visit done — now waiting on Coordinator recommendation & certification.";
      }
      return "Parents did not attend — now waiting on home visitation by the Guidance Counselor.";
    case "certification":
      if (caseData.certificationIssued) {
        return `Certified (${ELIGIBILITY_LABELS[caseData.eligibilityStatus] ?? caseData.eligibilityStatus}) — now waiting for the Principal's signature.`;
      }
      return "Parent engagement done — now waiting for ADM Coordinator recommendation & certification.";
    case "principal_approval":
      if (caseData.approved) {
        return "Principal signed — student is now completing modules under monitoring.";
      }
      if (caseData.eligibilityStatus === "ineligible") {
        return "Not eligible — waiting on the ADM Coordinator to complete the requirements.";
      }
      return "Certification done — now waiting for the Principal's signature.";
    case "enrollment_monitoring":
      return `Approved — now tracking module completion (${caseData.modulesSubmitted}/${caseData.modulesTotal} submitted).`;
    default:
      return "Case is moving through the ADM pipeline.";
  }
}
export function deriveAdmCaseStatus(
  stage: string,
  eligibility: string,
  approvedBy: string | null,
  referralStatus?: string | null
): { key: string; label: string } {
  if (referralStatus === "dismissed") {
    return { key: "cancelled", label: "Cancelled" };
  }
  if (referralStatus === "resolved") {
    return { key: "resolved_case", label: "Resolved" };
  }
  switch (stage) {
    case "consultation":
      return { key: "need_review", label: "Need review by ADM" };
    case "meeting_parents":
      return { key: "parent_meeting", label: "Parent meeting" };
    case "home_visitation":
      return { key: "home_visit", label: "Home visitation" };
    case "certification":
      return eligibility === "eligible"
        ? { key: "ready_to_endorse", label: "Ready to endorse" }
        : { key: "for_certification", label: "For certification" };
    case "principal_approval":
      if (approvedBy) return { key: "endorsed", label: "Endorsed" };
      return eligibility === "eligible"
        ? { key: "endorsed", label: "Endorsed to Principal" }
        : { key: "needs_revision", label: "Needs revision" };
    case "enrollment_monitoring":
      return { key: "monitoring", label: "Monitoring" };
    case "completion":
      return { key: "completed", label: "Completed" };
    default:
      return { key: "filed", label: "Anecdotal filed" };
  }
}
