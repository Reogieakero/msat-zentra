import * as React from "react";
import { Donut } from "./Donut";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./accounts-breakdown.module.css";

export type AccountBreakdown = {
  id: string;
  label: string; // e.g. "Grade 11 · 11-A (STEM)"
  withAccount: number;
  pending: number;
};

export function AccountsBreakdown({
  data,
  loading = false,
}: {
  data: AccountBreakdown[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <section className={styles.section}>
        <header className={styles.header}>
          <h2 className={styles.title}>Accounts Breakdown</h2>
          <p className={styles.subtitle}>
            Student accounts by grade level and section
          </p>
        </header>
        <div className={styles.grid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.card}>
              <Skeleton className={styles.skelHead} />
              <div className={styles.body}>
                <Skeleton className={styles.skelDonut} />
                <Skeleton className={styles.skelLegend} />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2 className={styles.title}>Accounts Breakdown</h2>
        <p className={styles.subtitle}>
          Student accounts by grade level and section
        </p>
      </header>

      <div className={styles.grid}>
        {data.map((d) => {
          const total = d.withAccount + d.pending;
          return (
            <article key={d.id} className={styles.card}>
              <header className={styles.cardHead}>
                <h3 className={styles.cardTitle}>{d.label}</h3>
                <span className={styles.total}>{total}</span>
              </header>

              <div className={styles.body}>
                <Donut
                  withAccount={d.withAccount}
                  pending={d.pending}
                />
                <ul className={styles.legend}>
                  <LegendItem
                    color="var(--primary)"
                    label="With account"
                    value={d.withAccount}
                  />
                  <LegendItem
                    color="var(--warn, #d97706)"
                    label="Pending"
                    value={d.pending}
                  />
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LegendItem({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <li className={styles.legendItem}>
      <span className={styles.swatch} style={{ backgroundColor: color }} />
      <span className={styles.legendLabel}>{label}</span>
      <span className={styles.legendValue}>{value}</span>
    </li>
  );
}
