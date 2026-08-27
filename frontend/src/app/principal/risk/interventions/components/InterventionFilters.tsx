import * as React from "react";
import type { RiskFactorKey } from "../types";
import styles from "../interventions.module.css";

const RISK_OPTS: { key: "all" | "Moderate" | "High"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "High", label: "High" },
  { key: "Moderate", label: "Moderate" },
];

const FACTOR_OPTS: { key: "all" | RiskFactorKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Academic", label: "Academic" },
  { key: "Attendance", label: "Attendance" },
  { key: "Behavioral", label: "Behavioral" },
];

export function InterventionFilters({
  value,
  onChange,
}: {
  value: {
    riskLevel: "all" | "Moderate" | "High";
    hasIntervention: boolean | undefined;
    factor: "all" | RiskFactorKey;
  };
  onChange: (next: {
    riskLevel: "all" | "Moderate" | "High";
    hasIntervention: boolean | undefined;
    factor: "all" | RiskFactorKey;
  }) => void;
}) {
  const group = (
    label: string,
    opts: { key: string; label: string }[],
    active: string,
    set: (k: string) => void
  ) => (
    <div className={styles.filterGroup}>
      <span className={styles.filterLabel}>{label}</span>
      <div className={styles.segmented} role="group" aria-label={label}>
        {opts.map((o) => (
          <button
            key={o.key}
            type="button"
            className={`${styles.segment} ${active === o.key ? styles.segmentOn : ""}`}
            aria-pressed={active === o.key}
            onClick={() => set(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  const hasOpts = [
    { key: "all", label: "All" },
    { key: "true", label: "Assigned" },
    { key: "false", label: "Not yet" },
  ];

  return (
    <div className={styles.toolbar}>
      {group("Risk", RISK_OPTS, value.riskLevel, (k) =>
        onChange({ ...value, riskLevel: k as "all" | "Moderate" | "High" })
      )}
      {group("Factor", FACTOR_OPTS, value.factor, (k) =>
        onChange({ ...value, factor: k as "all" | RiskFactorKey })
      )}
      {group(
        "Intervention",
        hasOpts,
        value.hasIntervention === undefined
          ? "all"
          : value.hasIntervention
            ? "true"
            : "false",
        (k) =>
          onChange({
            ...value,
            hasIntervention: k === "all" ? undefined : k === "true",
          })
      )}
    </div>
  );
}
