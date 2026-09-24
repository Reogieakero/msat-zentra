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
  if (!breakdown) return 0;
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

export const STAGE_COLORS = [
  "#171717",
  "#404040",
  "#525252",
  "#737373",
  "#a3a3a3",
  "#c9c9c9",
  "#d6d6d6",
  "#e7e7e7",
];
