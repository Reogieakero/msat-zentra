"use client";

import { Button } from "@/components/ui/button";
import styles from "./coordinator-enrolled-pager.module.css";

interface CoordinatorEnrolledPagerProps {
  total: number;
  start: number;
  end: number;
  page: number;
  totalPages: number;
  /** Background refresh with data on screen — subtle hint, no skeleton. */
  isBackground?: boolean;
  onPageChange: (page: number) => void;
}

export function CoordinatorEnrolledPager({
  total,
  start,
  end,
  page,
  totalPages,
  isBackground = false,
  onPageChange,
}: CoordinatorEnrolledPagerProps) {
  return (
    <div className={styles.pager}>
      <p className={styles.range}>
        Showing {start}–{end} of {total}
        {isBackground ? (
          <span aria-live="polite"> · Syncing…</span>
        ) : null}
      </p>
      <div className={styles.pagerButtons}>
        <Button
          size="xs"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </Button>
        <span className={styles.pageLabel} aria-live="polite">
          Page {page} of {totalPages}
        </span>
        <Button
          size="xs"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
