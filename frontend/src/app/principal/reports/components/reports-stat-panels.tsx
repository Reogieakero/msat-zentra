import { Badge } from "@/components/ui/badge";
import styles from "./reports-panels.module.css";
const LIST_COLORS = [
  "var(--primary)",
  "var(--accent-foreground)",
  "var(--muted-foreground)",
];
export function ListPanel({
  rows,
  labelKey,
  valueKey,
}: {
  rows: Record<string, string | number>[];
  labelKey: string;
  valueKey: string;
}) {
  const max = Math.max(...rows.map((r) => Number(r[valueKey])));
  return (
    <ul className={styles.list}>
      {rows.map((r, i) => (
        <li key={r[labelKey] as string} className={styles.listRow}>
          <span
            className={styles.listDot}
            style={{ background: LIST_COLORS[i % LIST_COLORS.length] }}
          />
          <span className={styles.listLabel}>{r[labelKey] as string}</span>
          <span className={styles.listBarTrack}>
            <span
              className={styles.listBarFill}
              style={{
                width: `${max ? (Number(r[valueKey]) / max) * 100 : 0}%`,
                background: LIST_COLORS[i % LIST_COLORS.length],
              }}
            />
          </span>
          <span className={styles.listValue}>{r[valueKey] as number}</span>
        </li>
      ))}
    </ul>
  );
}
export function AdmStagesCards({ rows }: { rows: { stage: string; count: number }[] }) {
  return (
    <div className={styles.kpiGrid}>
      {rows.map((s) => (
        <div key={s.stage} className={`${styles.kpiCard} ${styles.miniGlow}`}>
          <span className={styles.glowClip} aria-hidden="true">
            <span className={styles.cardGlow} />
          </span>
          <span className={styles.kpiCardValue}>{s.count}</span>
          <span className={styles.kpiCardLabel}>{s.stage}</span>
        </div>
      ))}
    </div>
  );
}
export function AccountsPanel({ rows }: { rows: { band: string; pending: number }[] }) {
  const total = rows.reduce((a, b) => a + b.pending, 0);
  return (
    <div className={styles.statWrap}>
      <span className={styles.statValue}>{total}</span>
      <span className={styles.statLabel}>accounts pending approval</span>
      <ul className={styles.statList}>
        {rows.map((a) => (
          <li key={a.band} className={styles.statRow}>
            <span>{a.band}</span>
            <Badge variant="secondary">{a.pending}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
