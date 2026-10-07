import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/services/principal/academics";

/* Risk-level color code — Low green, Moderate amber, High red — same as
   the guidance interventions desk. NOTE: the app theme is monochrome
   (`--destructive`/`--success`/`--warning` are near-black/white ink), so
   this uses the explicit red/amber/green badge variants — theme tokens
   would render gray. */
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
