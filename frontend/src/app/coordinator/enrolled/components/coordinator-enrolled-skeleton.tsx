"use client";

import { Skeleton } from "@/components/ui/skeleton";
import tableStyles from "./coordinator-enrolled-table.module.css";
import styles from "./coordinator-enrolled-skeleton.module.css";

const HEADS = [
  "Student",
  "Type",
  "Case status",
  "Eligibility",
  "Approved",
  "Date approved",
  "",
];

/* Full-section loading state that mirrors the enrolled table 1:1 — the
   7-column table with per-column shapes (two-line student, ADM pill,
   status pill, eligibility pill, approver, date, kebab) and the pager —
   so skeleton → content swaps with minimal layout shift. The table reuses
   the real table container (same min-width + scroll), so mobile matches
   automatically. Filters stay mounted above; this covers table + pager
   only. */
export function CoordinatorEnrolledSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading enrolled students">
      <div className={tableStyles.tableWrap} aria-hidden="true">
        <table className={`${tableStyles.table} ${tableStyles.alertTable}`}>
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
                  <Skeleton className={styles.approver} />
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
