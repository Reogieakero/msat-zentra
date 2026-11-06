"use client";
import styles from "./academics.module.css";
type CellStat = { avg: number; graded: number; below: number };
export function TrendTooltip({
  active,
  payload,
  label,
  detailByKey,
  series,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: string | number }[];
  label?: string | number;
  detailByKey: Record<string, CellStat>;
  series: string[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className={styles.chartTip}>
      <p className={styles.chartTipTitle}>{String(label ?? "")}</p>
      {series.map((grade) => {
        const entry = payload.find((p) => String(p.dataKey) === grade);
        if (!entry || entry.value == null || entry.value === "") {
          return (
            <p key={grade} className={styles.chartTipRow}>
              <span>{grade}</span>
              <span className={styles.chartTipMuted}>No grades yet</span>
            </p>
          );
        }
        const detail = detailByKey[`${label}::${grade}`];
        const avg = Number(entry.value);
        return (
          <p key={grade} className={styles.chartTipRow}>
            <span>{grade}</span>
            <span className={avg < 75 ? styles.chartTipBad : styles.chartTipAvg}>
              {avg}
              {detail
                ? ` · ${detail.graded} graded · ${detail.below} below 75`
                : ""}
            </span>
          </p>
        );
      })}
    </div>
  );
}
