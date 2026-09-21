"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GuidanceAnecdotalSummary } from "./guidance-anecdotal-data";
import styles from "./guidance-anecdotal-charts.module.css";

export function GuidanceAnecdotalGradeChart({ summary }: { summary: GuidanceAnecdotalSummary }) {
  const rows = (summary.byGrade ?? []).filter((r) => r.count > 0);
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0);

  return (
    <Card className={styles.card}>
      <CardHeader>
        <CardTitle className={styles.sectionTitle}>Referred records by grade level</CardTitle>
        <CardDescription className={styles.sectionDesc}>
          Live counts across all cases referred to you.
        </CardDescription>
      </CardHeader>
      <CardContent className={styles.body}>
        {summary.total === 0 || rows.length === 0 ? (
          <p className={styles.empty}>No cases referred to you yet.</p>
        ) : (
          <ul className={styles.legend}>
            {rows.map((r) => (
              <li key={r.grade} className={styles.legendItem}>
                <span className={styles.legendLabel}>{r.grade}</span>
                <span className={styles.barWrap} aria-hidden>
                  <span
                    className={styles.barFill}
                    style={{ width: max > 0 ? `${Math.max(6, Math.round((r.count / max) * 100))}%` : "6%" }}
                  />
                </span>
                <span className={styles.legendCount}>{r.count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
