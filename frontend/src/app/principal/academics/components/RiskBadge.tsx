import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "../academics-data";
import styles from "./RiskBadge.module.css";

const RISK_META: Record<
  RiskLevel,
  { label: string; className: string }
> = {
  High: { label: "High risk", className: styles.riskHigh },
  Moderate: { label: "Needs watch", className: styles.riskModerate },
  Low: { label: "On track", className: styles.riskLow },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const meta = RISK_META[level];
  return (
    <Badge variant="outline" className={`${styles.badge} ${meta.className}`}>
      <span className={styles.dot} aria-hidden />
      {meta.label}
    </Badge>
  );
}
