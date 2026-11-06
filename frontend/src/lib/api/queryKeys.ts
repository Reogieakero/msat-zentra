import { PAGE_SIZE } from "@/components/shared/pagination";

/** Canonical TanStack Query key: [module, resource, page, pageSize, filters, sort]. */
export function queryKey(
  module: string,
  resource: string,
  params: {
    page?: number;
    pageSize?: number;
    filters?: Record<string, unknown>;
    sort?: string;
  } = {},
): readonly unknown[] {
  const { page = 1, pageSize = PAGE_SIZE, filters = {}, sort = "" } = params;
  return [module, resource, page, pageSize, filters, sort] as const;
}

/**
 * Stale/GC presets per data type.
 * Static lookups (sections/subjects): long. Live data (attendance/clinic): short.
 */
export const CACHE_PRESETS = {
  static: { staleTime: 30 * 60 * 1000, gcTime: 2 * 60 * 60 * 1000 },
  semi: { staleTime: 60 * 1000, gcTime: 5 * 60 * 1000 },
  live: { staleTime: 15 * 1000, gcTime: 60 * 1000 },
} as const;

export type CachePresetName = keyof typeof CACHE_PRESETS;
