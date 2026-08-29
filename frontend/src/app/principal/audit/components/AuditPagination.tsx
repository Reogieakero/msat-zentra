import * as React from "react";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";

// Build a compact page list with ellipses, e.g. 1 … 4 5 6 … 20
function pageItems(current: number, count: number): (number | "ellipsis")[] {
  if (count <= 7) {
    return Array.from({ length: count }, (_, i) => i + 1);
  }
  const items: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(count - 1, current + 1);
  if (start > 2) items.push("ellipsis");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < count - 1) items.push("ellipsis");
  items.push(count);
  return items;
}

export function AuditPagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  const items = pageItems(page, pageCount);

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={() => onPageChange(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            style={page <= 1 ? { pointerEvents: "none", opacity: 0.5 } : undefined}
          />
        </PaginationItem>

        {items.map((it, i) =>
          it === "ellipsis" ? (
            <PaginationItem key={`e-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={it}>
              <PaginationLink
                isActive={it === page}
                onClick={() => onPageChange(it)}
              >
                {it}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationNext
            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
            aria-disabled={page >= pageCount}
            style={page >= pageCount ? { pointerEvents: "none", opacity: 0.5 } : undefined}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
