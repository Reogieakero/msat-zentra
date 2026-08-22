import { AppError } from "../lib/errors.js";

// PLAN.md §6.4 — ADM referral state machine. Illegal transitions rejected with 409.
// Stages are linear; each transition is gated by role in the route layer.

export type AdmStage =
  | "anecdotal"
  | "referred"
  | "parent_meeting"
  | "coordinator_review"
  | "principal_approval"
  | "release"
  | "completed";

const TRANSITIONS: Record<AdmStage, AdmStage[]> = {
  anecdotal: ["referred"],
  referred: ["parent_meeting"],
  parent_meeting: ["coordinator_review"],
  coordinator_review: ["principal_approval"],
  principal_approval: ["release"],
  release: ["completed"],
  completed: [],
};

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
