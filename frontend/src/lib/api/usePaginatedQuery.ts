"use client";

import { useEffect } from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { CACHE_PRESETS, queryKey, type CachePresetName } from "./queryKeys";
import { PAGE_SIZE } from "@/components/shared/pagination";

export interface PaginatedEnvelope<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface UsePaginatedQueryOptions<T> extends Omit<
  UseQueryOptions<PaginatedEnvelope<T>, Error>,
  "queryKey" | "queryFn"
> {
  module: string;
  resource: string;
  page: number;
  pageSize?: number;
  filters?: Record<string, unknown>;
  sort?: string;
  preset?: CachePresetName;
  fetcher: (signal: AbortSignal) => Promise<PaginatedEnvelope<T>>;
  prefetchNext?: boolean;
}

/**
 * One data-fetching pattern for every list view:
 * server-side page, placeholderData to avoid flicker, next-page prefetch,
 * AbortSignal cancellation when the query changes.
 */
export function usePaginatedQuery<T>({
  module,
  resource,
  page,
  pageSize = PAGE_SIZE,
  filters = {},
  sort = "",
  preset = "semi",
  fetcher,
  prefetchNext = true,
  ...rest
}: UsePaginatedQueryOptions<T>) {
  const queryClient = useQueryClient();
  const key = queryKey(module, resource, { page, pageSize, filters, sort });

  const query = useQuery<PaginatedEnvelope<T>, Error>({
    queryKey: key,
    queryFn: ({ signal }) => fetcher(signal),
    placeholderData: keepPreviousData,
    ...CACHE_PRESETS[preset],
    ...rest,
  });

  useEffect(() => {
    if (!prefetchNext || !query.data) return;
    if (page >= query.data.totalPages) return;
    const nextKey = queryKey(module, resource, { page: page + 1, pageSize, filters, sort });
    queryClient.prefetchQuery({
      queryKey: nextKey,
      queryFn: ({ signal }) => fetcher(signal),
      staleTime: CACHE_PRESETS[preset].staleTime,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data?.totalPages, page, module, resource]);

  return query;
}
