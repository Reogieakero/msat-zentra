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

  followUpOngoing: number;

  followUpDone: number;

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

  truncated: boolean;
}
