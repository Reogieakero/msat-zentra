export const PAGE_SIZE = 15;

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
