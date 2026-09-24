"use client";

import { Button } from "@/components/ui/button";
import styles from "./coordinator-referrals-pager.module.css";

interface CoordinatorReferralsPagerProps {
  total: number;
  start: number;
  end: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function CoordinatorReferralsPager({
  total,
  start,
  end,
  page,
  totalPages,
  onPageChange,
}: CoordinatorReferralsPagerProps) {
  return (
    <div className={styles.pager}>
      <p className={styles.range}>
        Showing {start}–{end} of {total}
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
