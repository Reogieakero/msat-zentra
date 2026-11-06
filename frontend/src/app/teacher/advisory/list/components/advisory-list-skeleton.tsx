"use client";

import { KanbanSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import listStyles from "./advisory-list.module.css";
import insightStyles from "./advisory-insight-board.module.css";

const TABLE_ROWS = 8;
const LANES = 4;

function ListRowSkeleton() {
  return (
    <div className="flex items-center border-t px-4 py-3">
      <div className="flex min-w-0 items-center gap-2" style={{ width: 170 }}>
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-4 w-24 rounded-full" />
        </div>
      </div>
      <div className="pl-2" style={{ width: 100 }}>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

/** Right pane of the split: the Student insight board at rest. */
function InsightSkeleton() {
  return (
    <div className={`${insightStyles.board} ${insightStyles.bare}`} aria-hidden>
      <header className={insightStyles.boardHead}>
        <span className={insightStyles.boardIcon}>
          <KanbanSquare size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-28" />
          <div className="mt-1 flex flex-wrap gap-1">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </header>

      <div className={insightStyles.plainSection}>
        <header className={insightStyles.laneHead}>
          <span className={insightStyles.laneDot} style={{ background: "var(--border)" }} />
          <Skeleton className="h-3 w-24" />
        </header>
        <ul className={insightStyles.cardGrid}>
          {Array.from({ length: LANES }).map((_, i) => (
            <li key={i} className="min-w-0">
              <section className={insightStyles.lane}>
                <header className={insightStyles.colHead}>
                  <Skeleton className="size-4 shrink-0 rounded-sm" />
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="ml-auto h-5 w-14 rounded-full" />
                </header>
                <div className={insightStyles.kCard}>
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-6 w-10" />
                  </div>
                </div>
              </section>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Advisory list loading state — mirrors the loaded page: one panel split into
 * the roster lane (head, filter, table, pagination) and the Student insight
 * board, plus the two-button action rail on the right.
 */
export function AdvisoryListSkeleton() {
  return (
    <section
      className={`${listStyles.pageLock} flex min-w-0 flex-col gap-3`}
      aria-busy="true"
      aria-label="Loading advisory list"
    >
      <div className="grid w-full items-start gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className={listStyles.panel} aria-hidden>
          <header className={listStyles.boardHead}>
            <span className={listStyles.boardIcon} aria-hidden>
              <KanbanSquare size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1 h-3 w-56" />
            </div>
          </header>

          <div className={listStyles.split}>
            <div className={listStyles.left}>
              <section className={listStyles.lane}>
                <header className={listStyles.laneHead}>
                  <span className={listStyles.laneDot} style={{ background: "#f59e0b" }} />
                  <Skeleton className="h-3 w-24" />
                </header>

                <Skeleton className="h-8 w-full rounded-[16px]" />

                <div className={listStyles.tableWrap}>
                  <div className="flex items-center bg-muted/50 px-4 py-3">
                    <Skeleton className="h-3 w-[7.5rem]" />
                    <Skeleton className="ml-2 h-3 w-10" />
                  </div>
                  {Array.from({ length: TABLE_ROWS }).map((_, i) => (
                    <ListRowSkeleton key={i} />
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-28" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                </div>
              </section>
            </div>

            <div className={listStyles.right}>
              <InsightSkeleton />
            </div>
          </div>
        </div>

        {/* Action rail — same two 36px buttons as the loaded page. */}
        <div className="flex flex-row justify-end gap-2 self-start lg:flex-col lg:items-end">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
      </div>
    </section>
  );
}
