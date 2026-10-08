"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./adviser-access-tables.module.css";
export function usePager(total: number, pageSize: number) {
  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  return { page, setPage, totalPages, safePage, start, end };
}
export function Pager({
  total,
  totalPages,
  safePage,
  start,
  end,
  setPage,
}: {
  total: number;
  totalPages: number;
  safePage: number;
  start: number;
  end: number;
  setPage: (p: number | ((p: number) => number)) => void;
}) {
  return (
    <div className={`${styles.footer} relative`}>
      <span className={styles.footerInfo}>
        {total > 0 ? `${start}–${end} of ${total}` : "0 of 0"}
      </span>
      <div className={styles.footerActions}>
        <Button
          variant="outline"
          size="sm"
          disabled={safePage <= 1 || total === 0}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft aria-hidden />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={safePage >= totalPages || total === 0}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
