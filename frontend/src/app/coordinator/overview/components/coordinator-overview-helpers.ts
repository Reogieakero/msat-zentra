"use client";

export interface AttentionItem {
  label: string;
  count: number | null;
  href: string;
  hint: string;
}

export interface StageDonutEntry {
  name: string;
  full: string;
  value: number;
  fill: string;
}

export function countFor(
  breakdown: { stage: string; count: number }[] | undefined,
  ...stages: string[]
): number {
  if (!Array.isArray(breakdown)) return 0;
  return breakdown
    .filter((s) => stages.includes(s.stage))
    .reduce((sum, s) => sum + s.count, 0);
}

export const SHORT_STAGE: Record<string, string> = {
  anecdotal: "Anecdotal",
  consultation: "Consult.",
  meeting_parents: "Parents",
  home_visitation: "Home visit",
  certification: "Certific.",
  principal_approval: "Principal",
  enrollment_monitoring: "Monitor",
  completion: "Done",
};

/**
 * Amber ramp shared by the stage donut and the right-rail boards — the same
 * amber-500 base the nurse / record-keeper overviews use, stepped by
 * transparency so it reads on light and dark surfaces.
 */
export const AMBER = "oklch(0.769 0.188 70.08)";

export const AMBER_RAMP = [
  AMBER,
  `color-mix(in oklch, ${AMBER}, transparent 18%)`,
  `color-mix(in oklch, ${AMBER}, transparent 34%)`,
  `color-mix(in oklch, ${AMBER}, transparent 50%)`,
  `color-mix(in oklch, ${AMBER}, transparent 64%)`,
  `color-mix(in oklch, ${AMBER}, transparent 76%)`,
  `color-mix(in oklch, ${AMBER}, transparent 85%)`,
  `color-mix(in oklch, ${AMBER}, transparent 92%)`,
];

export const STAGE_COLORS = AMBER_RAMP;
