import type { PillTone } from "@/components/ui/pill";

/**
 * One status → chip-tone map for every desk. Guidance already renders statuses
 * with the shared <Pill>; principal/teacher tables used rounded `Badge`s, so
 * both shapes drifted. Centralising the palette keeps the same status the
 * same colour on every page.
 *
 * Tones are the semantic families only (neutral | amber | red | green | blue |
 * violet) — no component styling lives here.
 */

/** ADM stage machine → chip tone. */
export const ADM_STAGE_TONE: Record<string, PillTone> = {
  anecdotal: "neutral",
  consultation: "blue",
  meeting_parents: "amber",
  home_visitation: "green",
  certification: "blue",
  principal_approval: "violet",
  enrollment_monitoring: "green",
  completion: "neutral",
};

export function admStageTone(stage: string): PillTone {
  return ADM_STAGE_TONE[stage] ?? "neutral";
}

/** ADM eligibility verdict. */
export function eligibilityTone(status: string): PillTone {
  if (status === "eligible") return "green";
  if (status === "ineligible") return "red";
  return "neutral";
}

export function eligibilityLabel(status: string): string {
  if (status === "eligible") return "Eligible";
  if (status === "ineligible") return "Ineligible";
  return "Pending";
}

/** Risk engine level. */
export function riskTone(level: string): PillTone {
  if (level === "High") return "red";
  if (level === "Moderate") return "amber";
  if (level === "Low") return "green";
  return "neutral";
}

/** Timetable section status (schedule approval desk). */
export const SCHEDULE_STATUS_TONE: Record<string, PillTone> = {
  submitted: "blue",
  approved: "green",
  returned: "amber",
  draft: "red",
  empty: "neutral",
};

export function scheduleTone(status: string): PillTone {
  return SCHEDULE_STATUS_TONE[status] ?? "neutral";
}

/** Intervention outcome / plan status. */
export function outcomeTone(status: string): PillTone {
  if (status === "resolved") return "green";
  if (status === "unresolved") return "red";
  if (status === "ongoing") return "blue";
  return "neutral";
}

export function outcomeLabel(status: string): string {
  if (status === "resolved") return "Resolved";
  if (status === "unresolved") return "Unresolved";
  if (status === "ongoing") return "Ongoing";
  return "No plan";
}
