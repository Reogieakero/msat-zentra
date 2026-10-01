"use client";

import { Card } from "@/components/ui/card";
import type { RiskDashboard } from "./risk-dashboard-data";
import styles from "./RiskSummaryStrip.module.css";

/**
 * One-line plain-words summary of the whole desk — students, urgent
 * attention, and the busiest section. Full-width glow strip above the
 * dashboard grid on both desks.
 */
export function RiskSummaryStrip({ dashboard }: { dashboard: RiskDashboard }) {
  const { totalStudents, highCount, matrix, totalCases } = dashboard;
  const topSection = matrix[0] ?? null;
  return (
    <Card className={`${styles.strip} ${styles.glow}`} aria-label="Desk summary">
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      <p className={styles.text} role="status">
        {totalStudents === 0 ? (
          <>No students on this desk yet — summaries will appear here once cases arrive.</>
        ) : (
          <>
            <strong className={styles.strong}>{totalStudents}</strong> student
            {totalStudents === 1 ? "" : "s"}
            {highCount > 0 ? (
              <>
                {" · "}
                <strong className={styles.urgent}>{highCount}</strong> need
                urgent attention
              </>
            ) : (
              <> · nobody needs urgent attention</>
            )}
            {topSection && totalCases > 0 ? (
              <>
                {" · "}busiest: {topSection.section} ({topSection.total} case
                {topSection.total === 1 ? "" : "s"})
              </>
            ) : null}
            .
          </>
        )}
      </p>
    </Card>
  );
}
