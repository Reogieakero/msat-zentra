"use client";

import { Button } from "@/components/ui/button";
import common from "./heatmap-table.module.css";

/** Sortable column header — text-only button (no direction icon); the
 *  aria-label carries the current direction for assistive tech. */
export function SortTh({
  label,
  sorted,
  onToggle,
}: {
  label: string;
  sorted: false | "asc" | "desc";
  onToggle: (e?: unknown) => void;
}) {
  const direction =
    sorted === "asc"
      ? "ascending"
      : sorted === "desc"
        ? "descending"
        : "not sorted";
  return (
    <button
      type="button"
      className={common.thSort}
      onClick={onToggle}
      aria-label={`Sort by ${label}, currently ${direction}`}
    >
      <span>{label}</span>
    </button>
  );
}

export function TablePager({
  start,
  end,
  total,
  page,
  totalPages,
  canPrev,
  canNext,
  onPrev,
  onNext,
  label,
}: {
  start: number;
  end: number;
  total: number;
  page: number;
  totalPages: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  label: string;
}) {
  return (
    <div className={common.pager}>
      <p className={common.range}>
        Showing {start}–{end} of {total} {label}
      </p>
      <div className={common.pagerButtons}>
        <Button
          size="xs"
          variant="outline"
          disabled={!canPrev || total === 0}
          onClick={onPrev}
        >
          Previous
        </Button>
        <span className={common.pageLabel} aria-live="polite">
          Page {page} of {totalPages}
        </span>
        <Button
          size="xs"
          variant="outline"
          disabled={!canNext || total === 0}
          onClick={() => onNext()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
