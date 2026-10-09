import { z } from "zod";

export const PAGE_SIZE = 15;
export const DEFAULT_PAGE = 1;
// Strict ceiling for normal list endpoints: 15 records per page.
// Bulk export/report endpoints must use their own explicitly-authorized
// handler instead of raising this limit.
export const MAX_PAGE_SIZE = 15;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export function shouldShowPagination(totalItems: number, pageSize: number = PAGE_SIZE): boolean {
  return totalItems > pageSize;
}

export function totalPagesFor(totalItems: number, pageSize: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize)));
}

export function clampPage(page: number, totalItems: number, pageSize: number = PAGE_SIZE): number {
  const totalPages = totalPagesFor(totalItems, pageSize);
  if (!Number.isFinite(page) || page < 1) return DEFAULT_PAGE;
  return Math.min(Math.floor(page), totalPages);
}

export function skipFor(page: number, pageSize: number = PAGE_SIZE): number {
  return (Math.max(1, Math.floor(page) || DEFAULT_PAGE) - 1) * pageSize;
}

interface ResolvePagingOptions {
  defaultPageSize?: number;
  maxPageSize?: number;
}

export function resolvePaging(
  query: unknown,
  opts: ResolvePagingOptions = {},
): { page: number; pageSize: number } {
  const q = (query ?? {}) as Record<string, unknown>;
  const defaultPageSize = opts.defaultPageSize ?? PAGE_SIZE;
  const maxPageSize = opts.maxPageSize ?? MAX_PAGE_SIZE;

  const rawPage = Number(q.page);
  const page =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : DEFAULT_PAGE;

  const rawSize =
    typeof q.pageSize !== "undefined" ? Number(q.pageSize) : Number(q.limit);
  const pageSize =
    Number.isFinite(rawSize) && rawSize > 0
      ? Math.min(Math.floor(rawSize), maxPageSize)
      : defaultPageSize;

  return { page, pageSize };
}

export function resolvePageSize(query: unknown, maxPageSize = MAX_PAGE_SIZE): number {
  return resolvePaging(query, { maxPageSize }).pageSize;
}

export function buildPaginationMeta(
  page: number,
  pageSize: number,
  totalItems: number,
): PaginationMeta {
  return {
    page: clampPage(page, totalItems, pageSize),
    pageSize,
    totalItems,
    totalPages: totalPagesFor(totalItems, pageSize),
  };
}

export function paginationQuerySchema(maxPageSize = MAX_PAGE_SIZE) {
  return z.object({
    page: z.coerce.number().int().min(1).optional().default(DEFAULT_PAGE),
    pageSize: z.coerce.number().int().min(1).max(maxPageSize).optional().default(PAGE_SIZE),
    limit: z.coerce.number().int().min(1).max(maxPageSize).optional(),
    q: z.string().trim().max(200).optional().default(""),
  });
}
