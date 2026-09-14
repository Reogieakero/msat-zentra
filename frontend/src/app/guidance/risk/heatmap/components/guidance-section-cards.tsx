"use client";

import type { GuidanceRiskFactorRow } from "../../components/guidance-risk-data";
import styles from "./guidance-section-cards.module.css";

interface GuidanceSectionCardsProps {
  rows: GuidanceRiskFactorRow[];
}

/**
 * Per-section cards — same live aggregates as the heatmap matrices, one card
 * per section: factor flags, risk levels, and follow-up state. Status-only
 * counts; detail lives in the at-risk queue and interventions pages.
 */
export function GuidanceSectionCards({ rows }: GuidanceSectionCardsProps) {
  if (rows.length === 0) return null;

  return (
    <ul className={styles.grid}>
      {rows.map((row) => (
        <li
          key={row.section}
          className={styles.card}
          title={`${row.section} · ${row.grade}`}
        >
          <div className={styles.head}>
            <div>
              <p className={styles.section}>{row.section}</p>
              <p className={styles.grade}>{row.grade}</p>
            </div>
            <span className={styles.attention}>
              {row.needsAttention} need{row.needsAttention === 1 ? "s" : ""} attention
            </span>
          </div>

          <div className={styles.statGrid} aria-label={`${row.section} flagged by factor`}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{row.academic}</span>
              <span className={styles.statLabel}>Academic</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{row.attendance}</span>
              <span className={styles.statLabel}>Attendance</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{row.behavioral}</span>
              <span className={styles.statLabel}>Behavioral</span>
            </div>
          </div>

          <div className={styles.levelRow} aria-label={`${row.section} by risk level`}>
            <span>
              High <strong>{row.high}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Moderate <strong>{row.moderate}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Low <strong>{row.low}</strong>
            </span>
          </div>

          <p
            className={styles.followRow}
            title={`${row.section}: ${row.followUpOngoing} ongoing follow-up(s), ${row.followUpDone} finished, ${row.followUpNone} flagged student(s) with no follow-up yet`}
          >
            Follow-ups: {row.followUpOngoing} ongoing · {row.followUpDone} done ·{" "}
            {row.followUpNone} not started
          </p>
        </li>
      ))}
    </ul>
  );
}
