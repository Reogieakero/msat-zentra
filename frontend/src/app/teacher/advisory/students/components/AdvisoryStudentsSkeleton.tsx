"use client";

import { BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import listStyles from "../../list/components/advisory-list.module.css";
import boardStyles from "../../list/components/advisory-insight-board.module.css";

const TABLE_ROWS = 8;
const SUBJECT_LANES = 4;

function ListRowSkeleton() {
  return (
    <div className="flex items-center border-t px-4 py-3">
      <div className="flex min-w-0 items-center gap-2" style={{ width: 170 }}>
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-5 w-24 rounded-md" />
        </div>
      </div>
      <div className="pl-2" style={{ width: 100 }}>
        <Skeleton className="h-3.5 w-10" />
      </div>
    </div>
  );
}

/** Right pane: the Student grades board (header pills + subject lanes). */
function GradesBoardSkeleton() {
  return (
    <div className={boardStyles.board} aria-hidden>
      <header className={boardStyles.boardHead}>
        <span className={boardStyles.boardIcon}>
          <BookOpen size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-32" />
          <div className="mt-1 flex flex-wrap gap-1">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      </header>

      <section className={boardStyles.plainSection}>
        <header className={boardStyles.laneHead}>
          <span className={boardStyles.laneDot} style={{ background: "var(--border)" }} />
          <Skeleton className="h-3 w-40" />
        </header>
        <ul className={boardStyles.cardGrid}>
          {Array.from({ length: SUBJECT_LANES }).map((_, i) => (
            <li key={i} className="min-w-0">
              <section className={boardStyles.lane}>
                <header className={boardStyles.colHead}>
                  <Skeleton className="size-[1.125rem] shrink-0 rounded-full" />
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="ml-auto h-5 w-12 rounded-full" />
                </header>
                <ul className={boardStyles.laneBody}>
                  <li className={boardStyles.kCard}>
                    <Skeleton className="h-3 w-20" />
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-6 w-12" />
                    </div>
                    <Skeleton className="h-3 w-4/5" />
                  </li>
                </ul>
              </section>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * Advisory students loading state — mirrors the loaded page: one panel split
 * into the roster lane (head, filter/select, Student/Average table,
 * pagination) and the Student grades board with its per-subject lanes.
 */
export function AdvisoryStudentsSkeleton() {
  return (
    <section
      className={`${listStyles.pageLock} flex min-w-0 flex-col gap-3`}
      aria-busy="true"
      aria-label="Loading advisory students"
    >
      <div className={listStyles.panel} aria-hidden>
        <header className={listStyles.boardHead}>
          <span className={listStyles.boardIcon} aria-hidden>
            <BookOpen size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-1 h-3 w-60" />
          </div>
        </header>

        <div className={listStyles.split}>
          <div className={listStyles.left}>
            <section className={listStyles.lane}>
              <header className={listStyles.laneHead}>
                <span className={listStyles.laneDot} style={{ background: "#f59e0b" }} />
                <Skeleton className="h-3 w-24" />
              </header>

              <div className={listStyles.toolbar}>
                <Skeleton className="h-8 min-w-0 flex-1 rounded-[16px]" />
                <Skeleton className="h-8 w-36 shrink-0" />
              </div>

              <div className={listStyles.tableWrap}>
                <div className="flex items-center bg-muted/50 px-4 py-3">
                  <Skeleton className="h-3 w-[7.5rem]" />
                  <Skeleton className="ml-2 h-3 w-14" />
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
            <GradesBoardSkeleton />
          </div>
        </div>
      </div>
    </section>
  );
}
