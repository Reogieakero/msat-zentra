import * as React from "react";
import { RISK_LEVEL_COLORS, type RiskLevelKey } from "../api";
import styles from "./LevelBadge.module.css";

export function LevelBadge({ level }: { level: RiskLevelKey }) {
  return (
    <span className={styles.levelBadge}>
      <span className={styles.levelDot} style={{ background: RISK_LEVEL_COLORS[level] }} />
      {level}
    </span>
  );
}
