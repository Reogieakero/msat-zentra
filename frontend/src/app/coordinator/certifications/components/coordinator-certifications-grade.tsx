"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CertSummary } from "./coordinator-certifications-data";
import styles from "./coordinator-certifications-charts.module.css";

export function CoordinatorCertificationsGradeChart({ summary }: { summary: CertSummary }) {
  const rows = (summary.byGrade ?? []).filter((r) => r.count > 0);
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0);

  return (
    <Card className={styles.card}>
      <CardHeader>
        <CardTitle className={styles.sectionTitle}>Certifications by grade level</CardTitle>
        <CardDescription className={styles.sectionDesc}>
          Live counts across every certification you issued.
        </CardDescription>
      </CardHeader>
      <CardContent className={styles.body}>
        {summary.total === 0 || rows.length === 0 ? (
          <div className={styles.emptyWrapGrade}>
            <p className={styles.empty}>No certifications on file yet.</p>
          </div>
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
