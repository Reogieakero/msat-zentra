// Heatmap shapes for the guidance risk board. Pure types only.
export interface GuidanceRiskFactorRow {
  section: string;
  grade: string;
  academic: number;
  attendance: number;
  behavioral: number;
  high: number;
  moderate: number;
  low: number;
  needsAttention: number;
  /** Flagged students in this section with an ongoing follow-up. */
  followUpOngoing: number;
  /** Flagged students in this section whose follow-up finished (resolved). */
  followUpDone: number;
  /** Flagged students in this section with no follow-up started yet. */
  followUpNone: number;
}

export interface GuidanceRiskHeatmap {
  termLabel: string;
  rows: GuidanceRiskFactorRow[];
  totals: {
    academic: number;
    attendance: number;
    behavioral: number;
    high: number;
    moderate: number;
    low: number;
    needsAttention: number;
    followUpOngoing: number;
    followUpDone: number;
    followUpNone: number;
  };
  /** True when the flagged-student scan stopped early (very large caseload). */
  truncated: boolean;
}
