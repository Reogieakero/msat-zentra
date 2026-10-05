"use client";

import { Skeleton } from "@/components/ui/skeleton";
import styles from "./coordinator-referrals-skeleton.module.css";

const HEADS = [
  "Student",
  "Referred by",
  "Case status",
  "Eligibility",
  "Meeting time",
  "Date referred",
  "Latest action",
  "",
];

function TableCardSkeleton({ rows }: { rows: number }) {
  return (
    <div className={styles.tableCard} aria-hidden="true">
      <div className={styles.cardHeadRow}>
        <div className={styles.cardHeadText}>
          <Skeleton className={styles.cardTitle} />
          <Skeleton className={styles.cardDesc} />
        </div>
        <div className={styles.cardHeadActions}>
          <Skeleton className={styles.search} />
          <Skeleton className={styles.filterBtn} />
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {HEADS.map((h, i) => (
                <th key={i} scope="col">
                  {h ? <span className={styles.thText}>{h}</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                <td>
                  <Skeleton className={styles.name} />
                  <Skeleton className={styles.sub} />
                </td>
                <td>
                  <Skeleton className={styles.dateSm} />
                </td>
                <td>
                  <Skeleton className={styles.badgeLg} />
                </td>
                <td>
                  <Skeleton className={styles.badgeMd} />
                </td>
                <td>
                  <Skeleton className={styles.date} />
                  <Skeleton className={styles.sub} />
                </td>
                <td>
                  <Skeleton className={styles.dateSm} />
                </td>
                <td>
                  <Skeleton className={styles.date} />
                  <Skeleton className={styles.sub} />
                </td>
                <td>
                  <Skeleton className={styles.kebab} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Skeleton className={styles.interpretation} />
    </div>
  );
}

function RailSkeleton() {
  return (
    <div aria-hidden="true" className={styles.railRow}>
      {[4, 2, 3, 4].map((lines, i) => (
        <div key={i} className={styles.railCard}>
          <Skeleton className={styles.railTitle} />
          <Skeleton className={styles.railDesc} />
          {Array.from({ length: lines }).map((_, j) => (
            <Skeleton key={j} className={styles.railLine} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* Loading state that mirrors the referrals layout 1:1 — glow table card
   (header controls + 7-column rows + interpretation), the 4 rail cards,
   and the pager — so skeleton → content swaps with minimal layout shift.
   Pass layout="table" when the rail is already mounted around it (in-table
   initial load) to avoid duplicates. */
export function CoordinatorReferralsSkeleton({
  rows = 10,
  layout = "full",
}: {
  rows?: number;
  layout?: "full" | "table";
}) {
  if (layout === "table") {
    return (
      <div aria-busy="true" aria-label="Loading referrals">
        <TableCardSkeleton rows={rows} />
      </div>
    );
  }
  return (
    <div aria-busy="true" aria-label="Loading referrals">
      <div className={styles.main} aria-hidden="true">
        <TableCardSkeleton rows={rows} />
        <div className={styles.pager}>
          <Skeleton className={styles.range} />
          <div className={styles.pagerButtons}>
            <Skeleton className={styles.pageBtn} />
            <Skeleton className={styles.pageLabel} />
            <Skeleton className={styles.pageBtn} />
          </div>
        </div>
        <RailSkeleton />
      </div>
    </div>
  );
}
