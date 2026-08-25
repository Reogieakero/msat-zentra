import * as React from "react";
import { FACTOR_CHIP, FACTOR_LABELS, type RiskFactor } from "../api";
import styles from "./FactorChip.module.css";

export function FactorChip({ factor, on }: { factor: RiskFactor; on: boolean }) {
  return on ? (
    <span
      className={styles.chip}
      style={{ background: FACTOR_CHIP[factor] }}
      title={FACTOR_LABELS[factor]}
    >
      {factor[0]}
    </span>
  ) : (
    <span className={styles.chipOff} title={`No ${FACTOR_LABELS[factor]} flag`}>
      {factor[0]}
    </span>
  );
}
