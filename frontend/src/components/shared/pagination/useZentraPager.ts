"use client";

import * as React from "react";
import { PAGE_SIZE, totalPagesFor } from "./constants";

export interface ZentraPager {
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  safePage: number;
  totalPages: number;
  start: number;
  end: number;
  reset: () => void;
}

export function useZentraPager(total: number, pageSize: number = PAGE_SIZE): ZentraPager {
  const [page, setPage] = React.useState(1);
  const totalPages = totalPagesFor(total, pageSize);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  const reset = React.useCallback(() => setPage(1), []);
  return { page, setPage, safePage, totalPages, start, end, reset };
}
