// Pure display helpers for advisory ADM cases: pipeline vocabulary,
// grade/initials formatting, avatar tones, per-stage status + headlines.
// No API calls. Note: `gradeLabel` ("G7" → "Grade 7") and `initialsOf`
// intentionally differ from the gradebook/sheet twins (different call
// sites, different contracts) — kept local, not centralized.
import type { AdmCase } from "./admCases.types";

/** Official 8-stage ADM pipeline (mirrors backend adm.ts + principal board). */
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

export function stageOrder(stage: string): number {
  return ADM_STAGES.find((s) => s.stage === stage)?.order ?? 2;
}

const GRADE_LABELS: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

export function gradeLabel(gradeLevel: string): string {
  return GRADE_LABELS[gradeLevel] ?? gradeLevel;
}

export function initialsOf(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/);
  return `${(parts[0] ?? "S").charAt(0)}${(parts[1] ?? "").charAt(0)}`.toUpperCase();
}

/** Deterministic avatar tone (1–5) per student so cards feel distinct. */
export function toneOf(key: string): 1 | 2 | 3 | 4 | 5 {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return ((Math.abs(hash) % 5) + 1) as 1 | 2 | 3 | 4 | 5;
}

export const ELIGIBILITY_LABELS: Record<string, string> = {
  pending: "For review",
  eligible: "Eligible",
  ineligible: "Ineligible",
};

export function stageStatus(caseData: AdmCase, stage: string): string {
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

/**
 * Headline status message in the same voice as the referrals workflow
 * ("done X — now waiting on Y"): what is finished and who the case is
 * waiting on. Status-only, derived from stage + evidence flags.
 */
export function caseHeadline(caseData: AdmCase): string {
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
