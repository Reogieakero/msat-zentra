/* Shared risk-status presentation (teacher, principal, guidance desks).
   Low renders green, Moderate amber, High red — in badges and dots alike. */

export type RiskLevel = "Low" | "Moderate" | "High";

export type RiskBadgeVariant = "green" | "amber" | "red";

export const RISK_LEVEL_META: Record<
  RiskLevel,
  { badge: RiskBadgeVariant; dot: string; label: string }
> = {
  Low: { badge: "green", dot: "#22c55e", label: "Low" },
  Moderate: { badge: "amber", dot: "#f59e0b", label: "Moderate" },
  High: { badge: "red", dot: "#ef4444", label: "High" },
};

export function riskBadgeVariant(level: string | null | undefined): RiskBadgeVariant {
  if (level === "Moderate") return "amber";
  if (level === "High") return "red";
  return "green";
}

export function riskDotColor(level: string | null | undefined): string {
  if (level === "Moderate") return RISK_LEVEL_META.Moderate.dot;
  if (level === "High") return RISK_LEVEL_META.High.dot;
  return RISK_LEVEL_META.Low.dot;
}
