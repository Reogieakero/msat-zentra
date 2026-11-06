"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PAGE_SIZE } from "./constants";

export interface UrlPagerFilters {
  q?: string;
  [key: string]: string | undefined;
}

interface UseUrlPagerOptions {
  pageParam?: string;
  searchParam?: string;
  extraParams?: string[];
  pageSize?: number;
}

/**
 * Single URL-synced pager for every list view.
 * Keeps page/search/filters/sort in the query string so refresh and
 * back/forward work. Resets to page 1 when search, filters, or sort change.
 * Clamps out-of-range pages against the known total.
 */
export function useUrlPager(
  totalItems: number,
  filters: UrlPagerFilters = {},
  opts: UseUrlPagerOptions = {},
) {
  const { pageParam = "page", searchParam = "q", extraParams = [], pageSize = PAGE_SIZE } = opts;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = useMemo(() => {
    const raw = Number(searchParams.get(pageParam) ?? "1");
    return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
  }, [searchParams, pageParam]);

  const search = searchParams.get(searchParam) ?? "";
  const extras = useMemo(() => {
    const out: Record<string, string> = {};
    for (const key of extraParams) {
      const v = searchParams.get(key);
      if (v !== null) out[key] = v;
    }
    return out;
  }, [searchParams, extraParams]);

  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalItems) / Math.max(1, pageSize)));
  // When the caller doesn't know the total yet (totalItems <= 0, e.g. before
  // the first fetch resolves), do NOT clamp the URL page down to 1.
  // Clamping here froze `pager.page` at 1 forever for every `useUrlPager(0)`
  // call site: the query key never changed, so React Query never refetched
  // while the URL said ?page=4. Only clamp once a real total is known.
  const hasKnownTotal = totalItems > 0;
  const safePage = hasKnownTotal ? Math.min(Math.max(1, page), totalPages) : page;

  const write = useCallback(
    (next: Record<string, string | number | undefined | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === undefined || v === null || v === "") params.delete(k);
        else params.set(k, String(v));
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const setPage = useCallback((p: number) => write({ [pageParam]: Math.max(1, Math.floor(p) || 1) }), [write, pageParam]);

  /** Call when search, filters, or sort change — resets to page 1. */
  const setFilters = useCallback(
    (next: UrlPagerFilters & { sort?: string }) => {
      write({ ...next, [pageParam]: 1 });
    },
    [write, pageParam],
  );

  void filters;

  return { page: safePage, rawPage: page, search, extras, totalPages, pageSize, setPage, setFilters };
}
