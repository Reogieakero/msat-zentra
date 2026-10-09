import { Skeleton } from "@/components/ui/skeleton";
import styles from "./structural.module.css";

export function DashboardCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <Skeleton className={styles.cardLabel} />
      <Skeleton className={styles.cardValue} />
      <Skeleton className={styles.cardHint} />
    </div>
  );
}

export function FilterBarSkeleton({ selects = 2 }: { selects?: number }) {
  return (
    <div className={styles.filterBar} aria-hidden="true">
      <Skeleton className={styles.search} />
      {Array.from({ length: selects }).map((_, i) => (
        <Skeleton key={i} className={styles.select} />
      ))}
      <Skeleton className={styles.filterBtn} />
    </div>
  );
}

export function TableSkeleton({
  rows = 8,
  columns = 4,
  withPager = true,
}: {
  rows?: number;
  columns?: number;
  withPager?: boolean;
}) {
  return (
    <div className={styles.tableWrap} aria-hidden="true">
      <div className={styles.tableHead}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className={styles.cell} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={styles.tableRow}>
          <div className={styles.cellMain}>
            <Skeleton className={styles.cellName} />
            <Skeleton className={styles.cellSub} />
          </div>
          {Array.from({ length: Math.max(1, columns - 1) }).map((_, c) => (
            <Skeleton key={c} className={c === 0 ? styles.cellBadge : styles.cell} />
          ))}
        </div>
      ))}
      {withPager ? (
        <div className={styles.pager}>
          <Skeleton className={styles.pagerRange} />
          <Skeleton className={styles.pagerBtn} />
          <Skeleton className={styles.pagerBtn} />
        </div>
      ) : null}
    </div>
  );
}

export function ChartSkeleton({
  compact = false,
  withLegend = true,
}: {
  compact?: boolean;
  withLegend?: boolean;
}) {
  return (
    <div className={styles.chart} aria-hidden="true">
      <Skeleton className={styles.chartTitle} />
      <Skeleton className={compact ? styles.chartBodySm : styles.chartBody} />
      {withLegend ? (
        <div className={styles.legend}>
          <Skeleton className={styles.legendChip} />
          <Skeleton className={styles.legendChip} />
          <Skeleton className={styles.legendChip} />
        </div>
      ) : null}
    </div>
  );
}

export function ModalSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      <div className={styles.modalBody}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className={styles.modalField} />
        ))}
      </div>
      <div className={styles.modalFooter}>
        <Skeleton className={styles.pagerBtn} />
        <Skeleton className={styles.pagerBtn} />
      </div>
    </div>
  );
}
