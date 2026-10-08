import { AppError } from "../lib/errors.js";

export type AdmStage =
  | "anecdotal"
  | "consultation"
  | "meeting_parents"
  | "home_visitation"
  | "certification"
  | "principal_approval"
  | "enrollment_monitoring"
  | "completion";

export const ADM_STAGES: AdmStage[] = [
  "anecdotal",
  "consultation",
  "meeting_parents",
  "home_visitation",
  "certification",
  "principal_approval",
  "enrollment_monitoring",
  "completion",
];

const TRANSITIONS: Record<AdmStage, AdmStage[]> = {
  anecdotal: ["consultation"],
  consultation: ["meeting_parents"],
  meeting_parents: ["home_visitation", "certification"],
  home_visitation: ["certification"],
  certification: ["principal_approval"],
  principal_approval: ["enrollment_monitoring"],
  enrollment_monitoring: ["completion"],
  completion: [],
};

export type AdmRole = "adviser" | "guidance" | "nurse" | "adm_coordinator" | "principal";

export interface AdmStageMeta {
  stage: AdmStage;
  order: number;
  label: string;
  owner: AdmRole;

  principalAction: boolean;
  description: string;
}

export const ADM_STAGE_FLOW: AdmStageMeta[] = [
  {
    stage: "anecdotal",
    order: 1,
    label: "Anecdotal record filed",
    owner: "adviser",
    principalAction: false,
    description: "Adviser documents a behavioral/academic concern.",
  },
  {
    stage: "consultation",
    order: 2,
    label: "Consultation and referral",
    owner: "guidance",
    principalAction: false,
    description: "Guidance Counselor / School Nurse review the record.",
  },
  {
    stage: "meeting_parents",
    order: 3,
    label: "Meeting with Parents/Guardians",
    owner: "adm_coordinator",
    principalAction: false,
    description:
      "Meeting with Parents/Legal Guardians attended by the ADM Coordinator and Teachers. Attended → Minutes of Meeting & Attendance Logbook; otherwise → Home Visitation.",
  },
  {
    stage: "home_visitation",
    order: 4,
    label: "Home Visitation (if no meeting)",
    owner: "guidance",
    principalAction: false,
    description:
      "If parents did not attend the meeting, a Home Visitation is conducted (GCForm-12). Both branches converge at the Coordinator recommendation.",
  },
  {
    stage: "certification",
    order: 5,
    label: "Recommendation & Certification",
    owner: "adm_coordinator",
    principalAction: false,
    description:
      "ADM Coordinator records the recommendation and issues the ADM Certification, preparing the module for release.",
  },
  {
    stage: "principal_approval",
    order: 6,
    label: "School Head (Principal) Approval",
    owner: "principal",
    principalAction: true,
    description:
      "Principal signs the certification and authorizes release of the module, scheduling of module distribution and submission, and follow-up counseling / psychosocial intervention.",
  },
  {
    stage: "enrollment_monitoring",
    order: 7,
    label: "Enrollment monitoring",
    owner: "adm_coordinator",
    principalAction: false,
    description: "Coordinator and teacher track attendance and module submissions.",
  },
  {
    stage: "completion",
    order: 8,
    label: "Completion and device return",
    owner: "adm_coordinator",
    principalAction: false,
    description: "Return of the learning device is recorded and status tracked.",
  },
];

export function canTransition(from: AdmStage, to: AdmStage): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: AdmStage, to: AdmStage) {
  if (!canTransition(from, to)) {
    throw new AppError(409, "ADM_INVALID_TRANSITION", `Cannot move from ${from} to ${to}`);
  }
}

export function requireHomeVisitation(attended: boolean): boolean {
  return !attended;
}

export type AdmEligibilityInput = {
  stage: AdmStage;
  forms: { formType: string; status?: string }[];
  parentMeetings: { attended: boolean }[];
};

export function evaluateAdmEligibility(input: AdmEligibilityInput): "pending" | "eligible" | "ineligible" {
  const { stage, forms, parentMeetings } = input;
  if (stage !== "certification" && stage !== "principal_approval" && stage !== "enrollment_monitoring" && stage !== "completion") {
    return "pending";
  }
  const has = (type: string, verified = false) =>
    forms.some((f) => f.formType === type && (!verified || f.status === "verified"));

  const referral = has("REFERRAL_FORM");
  const anecdotal = has("ANECDOTAL_REPORT");
  const certification = has("CERTIFICATION", true);
  const meetingAttended = parentMeetings.some((m) => m.attended) || has("MINUTES_OF_MEETING");
  const homeVisit = has("HV_FORM");

  const parentEngagement = meetingAttended || homeVisit;

  if (referral && anecdotal && certification && parentEngagement) return "eligible";

  return "ineligible";
}
