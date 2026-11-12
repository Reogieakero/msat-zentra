"use client";

import { KanbanBoard } from "@/components/ui/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./schedule.module.css";

const SKELETON_ROWS = 7;
const SKELETON_FILTERS = 7;

/**
 * Loading shell for the schedule desk. It renders the real page structure —
 * the four bucket buttons in the top-right corner, then the actual
 * KanbanBoard shell and the same table row layout — so swapping in live data
 * doesn't move anything on screen.
 */
export function ScheduleSkeleton() {
  return (
    <div className={styles.page} role="status" aria-label="Loading schedule" aria-busy="true">
      <div className={styles.topBar} aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className={styles.skelIconBtn} />
        ))}
      </div>
      <div className={styles.stack}>
        <div className={styles.boardWrap} aria-hidden="true">
          <KanbanBoard
            title={<Skeleton className={styles.skelTitle} />}
            icon={<Skeleton className={styles.skelTitleIcon} />}
            description={<Skeleton className={styles.skelDescription} />}
            actions={
              <div className={styles.filterRow}>
                {Array.from({ length: SKELETON_FILTERS }).map((_, i) => (
                  <Skeleton key={i} className={styles.skelFilterPill} />
                ))}
              </div>
            }
          >
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <tbody>
                  {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                    <tr key={i}>
                      <td>
                        <span className={styles.sectionCell}>
                          <Skeleton className={styles.skelAvatar} />
                          <Skeleton className={styles.skelName} />
                        </span>
                      </td>
                      <td>
                        <Skeleton className={styles.skelPill} />
                      </td>
                      <td>
                        <Skeleton className={styles.skelPillWide} />
                      </td>
                      <td>
                        <Skeleton className={styles.skelCount} />
                      </td>
                      <td>
                        <Skeleton className={styles.skelPill} />
                      </td>
                      <td className={styles.actionCol}>
                        <span className={styles.skelActions}>
                          <Skeleton className={styles.skelAction} />
                          <Skeleton className={styles.skelAction} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </KanbanBoard>
        </div>
      </div>
    </div>
  );
}
