import * as React from "react";
import type { RiskSnapshotStudent } from "../types";
import styles from "../interventions.module.css";

function riskClass(l: RiskSnapshotStudent["riskLevel"]): string {
  return l === "High" ? styles.riskHigh : l === "Moderate" ? styles.riskModerate : styles.riskLow;
}

function titleCase(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

const FACTOR_LABEL: Record<string, string> = {
  academic: "Academic",
  attendance: "Attendance",
  behavioral: "Behavioral",
};

function FactorChips({ factors }: { factors: RiskSnapshotStudent["factors"] }) {
  const active = (Object.keys(factors) as (keyof RiskSnapshotStudent["factors"])[]).filter(
    (k) => factors[k]
  );
  if (active.length === 0) return <span className={styles.note}>—</span>;
  return (
    <span className={styles.chips}>
      {active.map((k) => (
        <span key={k} className={styles.factorChip}>
          {FACTOR_LABEL[k]}
        </span>
      ))}
    </span>
  );
}

function statusPill(s: RiskSnapshotStudent): { cls: string; label: string } {
  const iv = s.intervention;
  if (!iv) return { cls: styles.statusNone, label: "None" };
  const approval =
    iv.approvalStatus === "approved"
      ? ` · ${titleCase(iv.outcomeStatus)}`
      : ` · ${titleCase(iv.approvalStatus)}`;
  return { cls: styles.statusNone, label: `Assigned${approval}` };
}

export function InterventionsTable({
  rows,
  loading,
  error,
  onSelect,
}: {
  rows: RiskSnapshotStudent[];
  loading: boolean;
  error: string | null;
  onSelect: (row: RiskSnapshotStudent) => void;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colLeft}>Student</th>
            <th>Section</th>
            <th>Risk</th>
            <th>Factors</th>
            <th className={styles.colLeft}>Intervention</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {error ? (
            <tr>
              <td colSpan={6} className={styles.error}>
                {error}
              </td>
            </tr>
          ) : loading ? (
            <SkeletonRows />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={6} className={styles.empty}>
                No at-risk students match the current filters.
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const pill = statusPill(r);
              return (
                <tr key={r.studentId} onClick={() => onSelect(r)}>
                  <td className={styles.colLeft}>
                    <div className={styles.stuName}>{r.studentName}</div>
                    <div className={styles.stuLrn}>{r.lrn}</div>
                  </td>
                  <td>{r.section}</td>
                  <td>
                    <span className={`${styles.risk} ${riskClass(r.riskLevel)}`}>
                      <span className={styles.riskDot} aria-hidden />
                      {r.riskLevel}
                    </span>
                  </td>
                  <td>
                    <FactorChips factors={r.factors} />
                  </td>
                  <td className={styles.colLeft}>
                    {r.intervention ? (
                      <span className={styles.recoText}>
                        {r.intervention.assignedStaffName
                          ? `→ ${r.intervention.assignedStaffName}`
                          : "Unassigned"}
                      </span>
                    ) : (
                      <span className={styles.note}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={`${styles.statusPill} ${pill.cls}`}>{pill.label}</span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={`skel-${i}`}>
          <td className={styles.colLeft}>
            <span className={styles.skelCell} style={{ width: "70%" }} />
          </td>
          <td>
            <span className={styles.skelCell} style={{ width: "60%" }} />
          </td>
          <td>
            <span className={styles.skelCell} style={{ width: "50%", height: "16px" }} />
          </td>
          <td>
            <span className={styles.skelCell} style={{ width: "40%" }} />
          </td>
          <td className={styles.colLeft}>
            <span className={styles.skelCell} style={{ width: "80%" }} />
          </td>
          <td>
            <span className={styles.skelCell} style={{ width: "60%", height: "16px" }} />
          </td>
        </tr>
      ))}
    </>
  );
}
