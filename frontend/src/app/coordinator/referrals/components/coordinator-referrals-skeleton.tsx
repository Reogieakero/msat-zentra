"use client";

import { Skeleton } from "@/components/ui/skeleton";
import tableStyles from "./coordinator-referrals-table.module.css";
import styles from "./coordinator-referrals-skeleton.module.css";

const HEADS = [
  "Student",
  "Type",
  "Case status",
  "Eligibility",
  "Meeting",
  "Meeting time",
  "Date referred",
  "",
];

/* Full-page loading state that mirrors the referrals layout 1:1 — header
   (title + description + search + status filter), the 8-column table with
   per-column shapes (two-line student, badge pills, book-button pill,
   two-line datetime, date, kebab), and the pager — so skeleton → content
   swaps with minimal layout shift. The table reuses the real table
   container (same min-width + scroll), so mobile matches automatically.
   Pass includeHeader={false} when the real filters header is already
   mounted above (in-table initial load) to avoid a duplicated header. */
export function CoordinatorReferralsSkeleton({
  rows = 10,
  includeHeader = true,
}: {
  rows?: number;
  includeHeader?: boolean;
}) {
  return (
    <div aria-busy="true" aria-label="Loading referrals">
      {includeHeader ? (
        <div className={styles.head} aria-hidden="true">
          <div>
            <Skeleton className={styles.title} />
            <Skeleton className={styles.desc} />
          </div>
          <div className={styles.actions}>
            <Skeleton className={styles.search} />
            <Skeleton className={styles.filterBtn} />
          </div>
        </div>
      ) : null}

      <div className={tableStyles.tableWrap} aria-hidden="true">
        <table
          className={`${tableStyles.table} ${tableStyles.alertTable}`}
        >
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
                  <Skeleton className={styles.badgeSm} />
                </td>
                <td>
                  <Skeleton className={styles.badgeLg} />
                </td>
                <td>
                  <Skeleton className={styles.badgeMd} />
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
                  <Skeleton className={styles.kebab} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.pager} aria-hidden="true">
        <Skeleton className={styles.range} />
        <div className={styles.pagerButtons}>
          <Skeleton className={styles.pageBtn} />
          <Skeleton className={styles.pageLabel} />
          <Skeleton className={styles.pageBtn} />
        </div>
      </div>
    </div>
  );
}
