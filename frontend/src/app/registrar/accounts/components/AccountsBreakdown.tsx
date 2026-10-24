import { Users } from "lucide-react";
import { Donut, DONUT_TONES, type DonutTone } from "./Donut";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoardHeader } from "@/components/ui/kanban-board";
import styles from "./accounts-breakdown.module.css";

export type AccountBreakdown = {
  id: string;
  label: string;
  withAccount: number;
  pending: number;
  noAccount?: number;
  total?: number;
};

// Kanban display — one column per grade level / section, mirroring the
// overview stats board: kanban column shell + header + stat card, with the
// donut + legend as the column's stat readout (no outer card wrapper).
export function AccountsBreakdown({
  data,
  loading = false,
}: {
  data: AccountBreakdown[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <section
        className={styles.board}
        aria-label="Accounts breakdown loading"
        aria-busy="true"
      >
        <div className={styles.grid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.column} aria-hidden="true">
              <div className={styles.headSkeleton}>
                <Skeleton className={styles.skelTitle} />
                <Skeleton className={styles.skelCount} />
              </div>
              <Skeleton className={styles.skelStat} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.board} aria-label="Accounts breakdown">
      <div className={styles.grid}>
        {data.map((d) => {
          const noAccount = d.noAccount ?? 0;
          const total = d.total ?? d.withAccount + d.pending + noAccount;
          return (
            <article
              key={d.id}
              className={styles.column}
              aria-label={`${d.label}, ${total} learners: ${d.withAccount} with account, ${d.pending} pending, ${noAccount} no account`}
            >
              <KanbanBoardHeader
                icon={<Users size={14} className="text-primary" aria-hidden />}
                title={d.label}
                count={total}
              />

              <div className={styles.stat}>
                <BreakdownReadout
                  withAccount={d.withAccount}
                  pending={d.pending}
                  noAccount={noAccount}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// Donut + legend readout shared by the breakdown columns and the right
// section rail's flyout panels.
export function BreakdownReadout({
  withAccount,
  pending,
  noAccount = 0,
  tone = "primary",
}: {
  withAccount: number;
  pending: number;
  noAccount?: number;
  tone?: DonutTone;
}) {
  const colors = DONUT_TONES[tone];
  return (
    <div className={styles.readout}>
      <Donut withAccount={withAccount} pending={pending} noAccount={noAccount} tone={tone} />
      <ul className={styles.legend}>
        <LegendItem color={colors.withAccount} label="With account" value={withAccount} />
        <LegendItem color={colors.pending} label="Pending" value={pending} />
        <LegendItem color={colors.noAccount} label="No account" value={noAccount} />
      </ul>
    </div>
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
