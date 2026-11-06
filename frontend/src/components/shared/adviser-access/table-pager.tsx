"use client";
import * as React from "react";
import { Pagination } from "@/components/shared/pagination";
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
  setPage,
}: {
  total: number;
  totalPages: number;
  safePage: number;
  start: number;
  end: number;
  setPage: (p: number | ((p: number) => number)) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <Pagination
      currentPage={safePage}
      totalItems={total}
      onPageChange={(p) => setPage(p)}
    />
  );
}
