import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/services/principal/academics";

const RISK_VARIANT: Record<RiskLevel, "red" | "amber" | "green"> = {
  High: "red",
  Moderate: "amber",
  Low: "green",
};

const RISK_LABEL: Record<RiskLevel, string> = {
  High: "High",
  Moderate: "Moderate",
  Low: "Low",
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <Badge variant={RISK_VARIANT[level]}>{RISK_LABEL[level]}</Badge>;
}
