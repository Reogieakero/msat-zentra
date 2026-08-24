export type RiskLevelKey = "High" | "Moderate" | "Low";

export type OutcomeSummary = {
  ongoing: number;
  resolved: number;
  unresolved: number;
};

export const RISK_LEVEL_COLORS: Record<RiskLevelKey, string> = {
  High: "#b91c1c",
  Moderate: "#d97706",
  Low: "#15803d",
};

export const FACTOR_TOTALS = {
  Academic: 63,
  Attendance: 47,
  Behavioral: 28,
};

export const OUTCOME_SUMMARY: OutcomeSummary = {
  ongoing: 42,
  resolved: 58,
  unresolved: 9,
};

