"use client";

import type { AdmEligibility } from "@/services/coordinator/coordinator.types";

export const ELIG_OPTIONS: { value: "all" | AdmEligibility; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "For Review" },
  { value: "eligible", label: "Eligible" },
  { value: "ineligible", label: "Ineligible" },
];
