"use client";

import { Pill } from "@/components/ui/pill";
import type { TeacherReportsPayload } from "@/services/teacher/reports.types";
import { formatPercent } from "./reports-format";
import styles from "./reports.module.css";

export function ReportsDistribution({
  distribution,
}: {
  distribution: TeacherReportsPayload["distribution"];
}) {
  const total = distribution.reduce((sum, band) => sum + band.count, 0);
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className="min-w-0">
          <h2 className={styles.cardTitle}>Grade distribution</h2>
          <p className={styles.cardSub}>
            DepEd bands across {total} final grade{total === 1 ? "" : "s"} this term.
          </p>
        </div>
      </div>
      {total === 0 ? (
        <p className={styles.empty}>No finalized grades yet this term.</p>
      ) : (
        <div className={styles.bars}>
          {distribution.map((band) => (
            <div
              key={band.band}
              className={styles.barRow}
              role="group"
              aria-label={`${band.label}: ${band.count} learners, ${formatPercent(band.percent, 1)}`}
            >
              <span className={styles.barLabel}>
                <strong>{band.label}</strong>
                <span>{band.band}</span>
              </span>
              <span className={styles.barTrack} aria-hidden="true">
                <span
                  className={styles.barFill}
                  style={{ width: `${Math.max(band.percent * 100, band.count > 0 ? 2 : 0)}%` }}
                />
              </span>
              <span className={styles.barValue}>
                <Pill tone="neutral" label="Learners in this band">
                  {band.count}
                </Pill>
                <Pill tone={band.count > 0 ? "blue" : "neutral"} label="Share of final grades">
                  {formatPercent(band.percent)}
                </Pill>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
