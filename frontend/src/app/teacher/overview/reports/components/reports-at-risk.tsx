"use client";

import { Pill } from "@/components/ui/pill";
import type { RiskFlag, TeacherReportAtRiskRow } from "@/services/teacher/reports.types";
import { FLAG_LABELS, formatGrade, formatPercent } from "./reports-format";
import styles from "./reports.module.css";

const RISK_TONE = {
  High: "red",
  Moderate: "amber",
  Low: "green",
} as const;

const FLAG_TONE: Record<RiskFlag, "blue" | "amber" | "violet"> = {
  academic: "blue",
  attendance: "amber",
  behavioral: "violet",
};

export function ReportsAtRisk({ rows }: { rows: TeacherReportAtRiskRow[] }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className="min-w-0">
          <h2 className={styles.cardTitle}>Learners at risk</h2>
          <p className={styles.cardSub}>
            Live risk from grades, attendance, and anecdotal records this term.
          </p>
        </div>
        {rows.length > 0 ? <Pill tone="red">{rows.length}</Pill> : null}
      </div>
      {rows.length === 0 ? (
        <p className={styles.empty}>No learner is flagged at risk in this term.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Learner</th>
                <th scope="col">Risk</th>
                <th scope="col">Flags</th>
                <th scope="col" className={styles.num}>Average</th>
                <th scope="col" className={styles.num}>Attendance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.studentId}>
                  <td>
                    <span className={styles.classCell}>
                      <span className={styles.className}>{row.name}</span>
                      <span className={styles.classMeta}>{row.section}</span>
                    </span>
                  </td>
                  <td>
                    <div className={styles.riskCell}>
                      <Pill tone={RISK_TONE[row.riskLevel]}>{row.riskLevel}</Pill>
                    </div>
                  </td>
                  <td>
                    <div className={styles.chips}>
                      {row.flags.length === 0 ? (
                        <span className={styles.classMeta}>—</span>
                      ) : (
                        row.flags.map((flag) => (
                          <Pill key={flag} tone={FLAG_TONE[flag]}>
                            {FLAG_LABELS[flag] ?? flag}
                          </Pill>
                        ))
                      )}
                    </div>
                  </td>
                  <td className={styles.num}>{formatGrade(row.average, 1)}</td>
                  <td className={styles.num}>{formatPercent(row.attendanceRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
