"use client";

import type { AdmCaseRow, AdmEligibility } from "../../components/coordinator-data";

export const STAGE_OPTIONS = [
  { value: "all", label: "All stages" },
  { value: "consultation", label: "Consultation & referral" },
  { value: "meeting_parents", label: "Meeting with parents" },
  { value: "home_visitation", label: "Home visitation" },
  { value: "certification", label: "Recommendation & certification" },
  { value: "principal_approval", label: "Principal approval" },
];

export const ELIG_OPTIONS: { value: "all" | AdmEligibility; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "For Review" },
  { value: "eligible", label: "Eligible" },
  { value: "ineligible", label: "Ineligible" },
];

export const FORM_LABELS: Record<string, string> = {
  REFERRAL_FORM: "Referral form",
  ANECDOTAL_REPORT: "Anecdotal report",
  MINUTES_OF_MEETING: "Minutes of meeting",
  HV_FORM: "Home visitation form",
  CERTIFICATION: "ADM certification",
};

export const FORM_DOT: Record<string, string> = {
  verified: "#16a34a",
  submitted: "#ca8a04",
  pending: "#d4d4d4",
};

export function isEarlyRow(row: AdmCaseRow): boolean {
  return row.id.startsWith("referral:");
}
