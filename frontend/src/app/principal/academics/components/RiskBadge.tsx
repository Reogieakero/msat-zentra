import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "../mockData";
import styles from "./RiskBadge.module.css";

const RISK_CLASS: Record<RiskLevel, string> = {
  High: styles.riskHigh,
  Moderate: styles.riskModerate,
  Low: styles.riskLow,
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <Badge variant="outline" className={RISK_CLASS[level]}>{level}</Badge>;
}
