import { Pill } from "@/components/ui/pill";
import { riskTone } from "@/lib/labels/status-tone";
import type { RiskLevel } from "@/services/principal/academics";

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <Pill tone={riskTone(level)} label="Risk level">
      {level}
    </Pill>
  );
}
