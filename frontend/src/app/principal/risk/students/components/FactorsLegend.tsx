import * as React from "react";
import { FACTOR_CHIP, FACTOR_LABELS, type RiskFactor } from "../api";
import styles from "./FactorsLegend.module.css";

export function FactorsLegend({ factors }: { factors: RiskFactor[] }) {
  return (
    <div className={styles.legend}>
      <span className={styles.legendLabel}>Factors</span>
      {factors.map((f) => (
        <span key={f} className={styles.legendItem}>
          <span className={styles.legendSwatch} style={{ background: FACTOR_CHIP[f] }}>
            {f[0]}
          </span>
          {FACTOR_LABELS[f]}
        </span>
      ))}
    </div>
  );
}
