import * as React from "react";
import { type BackendStudent, type RiskFactor } from "../api";
import { LevelBadge } from "./LevelBadge";
import { FactorChip } from "./FactorChip";
import { FactorsLegend } from "./FactorsLegend";
import styles from "./StudentsTable.module.css";

export function StudentsTable({
  students,
  loading,
  error,
  query,
  factors,
  selectedSection,
}: {
  students: BackendStudent[];
  loading: boolean;
  error: string | null;
  query: string;
  factors: RiskFactor[];
  selectedSection: string | null;
}) {
  return (
    <div className={styles.browserFade} key={`${selectedSection ?? "all"}-${query}`}>
      <FactorsLegend factors={factors} />
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colLeft}>Student</th>
            <th className={styles.colLeft}>LRN</th>
            <th>Section</th>
            <th>Risk</th>
            <th className={styles.mono}>Count</th>
            <th>Factors</th>
          </tr>
        </thead>
        <tbody>
          {error ? (
            <tr>
              <td colSpan={6} className={styles.empty}>
                {error}
              </td>
            </tr>
          ) : loading ? (
            <SkeletonRows />
          ) : students.length === 0 ? (
            <tr>
              <td colSpan={6} className={styles.empty}>
                {query.trim()
                  ? `No students match “${query}”.`
                  : "No at-risk students in this scope."}
              </td>
            </tr>
          ) : (
            <StudentRows students={students} factors={factors} />
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
            <span className={styles.skelCell} style={{ width: "80%" }} />
          </td>
          <td className={styles.colLeft}>
            <span className={`${styles.skelCell} ${styles.mono}`} style={{ width: "62%" }} />
          </td>
          <td>
            <span className={styles.skelCell} style={{ width: "70%" }} />
          </td>
          <td>
            <span className={styles.skelCell} style={{ width: "55%", height: "16px" }} />
          </td>
          <td className={styles.mono}>
            <span className={styles.skelCell} style={{ width: "40%" }} />
          </td>
          <td>
            <span className={styles.chips}>
              <span className={styles.skelChip} />
              <span className={styles.skelChip} />
              <span className={styles.skelChip} />
            </span>
          </td>
        </tr>
      ))}
    </>
  );
}

function StudentRows({
  students,
  factors,
}: {
  students: BackendStudent[];
  factors: RiskFactor[];
}) {
  return (
    <>
      {students.map((s) => (
        <tr key={s.studentId}>
          <td className={styles.colLeft}>{s.name}</td>
          <td className={styles.colLeft}>
            <span className={styles.mono}>{s.lrn}</span>
          </td>
          <td>{s.section}</td>
          <td>
            <LevelBadge level={s.riskLevel} />
          </td>
          <td className={styles.mono}>{s.riskCount}</td>
          <td>
            <span className={styles.chips}>
              {factors.map((f) => (
                <React.Fragment key={f}>
                  <FactorChip factor={f} on={s.factors[f]} />
                </React.Fragment>
              ))}
            </span>
          </td>
        </tr>
      ))}
    </>
  );
}
