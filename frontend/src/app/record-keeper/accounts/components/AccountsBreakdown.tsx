import { Donut } from "./Donut";
import { Skeleton } from "@/components/ui/skeleton";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./accounts-breakdown.module.css";

export type AccountBreakdown = {
  id: string;
  label: string;
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
      <section className={assign.card} aria-label="Accounts breakdown loading">
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <header className={`${styles.header} relative`}>
          <h2 className="text-base font-semibold">Accounts Breakdown</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Student accounts by grade level and section
          </p>
        </header>
        <div className={`${styles.grid} relative`}>
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
    <section className={assign.card} aria-labelledby="accounts-breakdown">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <header className={`${styles.header} relative`}>
        <h2 id="accounts-breakdown" className="text-base font-semibold">Accounts Breakdown</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Student accounts by grade level and section
        </p>
      </header>

      <div className={`${styles.grid} relative`}>
        {(Array.isArray(data) ? data : []).map((d) => {
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
                    color="color-mix(in oklch, var(--primary) 65%, var(--card))"
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
