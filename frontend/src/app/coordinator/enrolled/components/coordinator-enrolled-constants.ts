"use client";

import type { AdmEligibility } from "../../components/coordinator-data";

export const ELIG_OPTIONS: { value: "all" | AdmEligibility; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "For Review" },
  { value: "eligible", label: "Eligible" },
  { value: "ineligible", label: "Ineligible" },
];

export const STAGE_TABS = [
  { value: "enrollment_monitoring", label: "Monitoring" },
  { value: "completion", label: "Completed" },
] as const;
