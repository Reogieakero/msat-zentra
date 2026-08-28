import { AppError } from "../lib/errors.js";

// PLAN.md §6.4 — ADM referral state machine, extended to the 8-stage
// ADM Case Pipeline used by the Principal dashboard:
//   1. anecdotal          — Adviser files a behavioral/academic record
//   2. consultation        — Guidance Counselor / School Nurse review
//   3. referred            — Student referred to ADM Coordinator
//   4. eligibility         — Coordinator evaluates profile + supporting records
//   5. principal_approval  — Principal final-signs the forwarded recommendation
//   6. certification       — Coordinator certifies + issues the learning device
//   7. enrollment_monitoring— Coordinator + teacher track attendance/modules
//   8. completion          — Device return recorded; case closed
// Linear stages; illegal transitions are rejected with 409 (role gating in routes).

export type AdmStage =
  | "anecdotal"
  | "consultation"
  | "referred"
  | "eligibility"
  | "principal_approval"
  | "certification"
  | "enrollment_monitoring"
  | "completion";

export const ADM_STAGES: AdmStage[] = [
  "anecdotal",
  "consultation",
  "referred",
  "eligibility",
  "principal_approval",
  "certification",
  "enrollment_monitoring",
  "completion",
];

const TRANSITIONS: Record<AdmStage, AdmStage[]> = {
  anecdotal: ["consultation"],
  consultation: ["referred"],
  referred: ["eligibility"],
  eligibility: ["principal_approval"],
  principal_approval: ["certification"],
  certification: ["enrollment_monitoring"],
  enrollment_monitoring: ["completion"],
  completion: [],
};

export type AdmRole = "adviser" | "guidance" | "nurse" | "adm_coordinator" | "principal";

export interface AdmStageMeta {
  stage: AdmStage;
  order: number;
  label: string;
  owner: AdmRole;
  /** True when this stage is an action owned by the Principal. */
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
    stage: "referred",
    order: 3,
    label: "Referral to ADM Coordinator",
    owner: "adm_coordinator",
    principalAction: false,
    description: "Student recommended for ADM is referred.",
  },
  {
    stage: "eligibility",
    order: 4,
    label: "Eligibility evaluation",
    owner: "adm_coordinator",
    principalAction: false,
    description: "Coordinator reviews the student's profile and supporting records.",
  },
  {
    stage: "principal_approval",
    order: 5,
    label: "Principal review and approval",
    owner: "principal",
    principalAction: true,
    description: "Final approval of the forwarded recommendation.",
  },
  {
    stage: "certification",
    order: 6,
    label: "Certification and device issuance",
    owner: "adm_coordinator",
    principalAction: false,
    description: "Coordinator records ADM certification and distributes the tablet.",
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

// Parent meeting branch: attended → minutes + logbook; else → home visitation.
export function requireHomeVisitation(attended: boolean): boolean {
  return !attended;
}
