"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAGE_SIZE, shouldShowPagination, totalPagesFor } from "./constants";
import styles from "./ZentraPagination.module.css";

export interface ZentraPaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  compact?: boolean;
}

function pageWindow(current: number, totalPages: number): number[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const window = new Set<number>([1, 2, current - 1, current, current + 1, totalPages - 1, totalPages]);
  return [...window].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
}

export function ZentraPagination({
  currentPage,
  totalItems,
  pageSize = PAGE_SIZE,
  onPageChange,
  compact = false,
}: ZentraPaginationProps) {
  if (!shouldShowPagination(totalItems, pageSize)) return null;

  const totalPages = totalPagesFor(totalItems, pageSize);
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);
  const go = (p: number) => onPageChange(Math.min(Math.max(1, p), totalPages));
  const pages = compact ? [] : pageWindow(safePage, totalPages);

  return (
    <nav aria-label="Pagination" className={styles.footer}>
      <span className={styles.footerInfo} aria-live="polite">
        {`Showing ${start}–${end} of ${totalItems} · Page ${safePage} of ${totalPages}`}
      </span>
      <div className={styles.footerActions}>
        {!compact && (
          <Button
            variant="outline"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => go(1)}
            aria-label="Go to first page"
          >
            <ChevronsLeft aria-hidden />
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={safePage <= 1}
          onClick={() => go(safePage - 1)}
          aria-label="Go to previous page"
        >
          <ChevronLeft aria-hidden />
          Previous
        </Button>
        {!compact && pages.length > 0 && (
          <ul className={styles.pageList}>
            {pages.map((p) => (
              <li key={p}>
                <Button
                  variant={p === safePage ? "default" : "ghost"}
                  size="sm"
                  className={`${styles.pageButton} ${p === safePage ? styles.pageButtonCurrent : ""}`}
                  aria-label={`Go to page ${p}`}
                  aria-current={p === safePage ? "page" : undefined}
                  onClick={() => go(p)}
                >
                  {p}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={safePage >= totalPages}
          onClick={() => go(safePage + 1)}
          aria-label="Go to next page"
        >
          Next
          <ChevronRight aria-hidden />
        </Button>
        {!compact && (
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => go(totalPages)}
            aria-label="Go to last page"
          >
            <ChevronsRight aria-hidden />
          </Button>
        )}
      </div>
    </nav>
  );
}

export { PAGE_SIZE };
