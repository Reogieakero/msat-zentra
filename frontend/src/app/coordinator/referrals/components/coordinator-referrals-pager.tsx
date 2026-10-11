"use client";

import { Pagination } from "@/components/shared/pagination";

interface CoordinatorReferralsPagerProps {
  total: number;
  start: number;
  end: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function CoordinatorReferralsPager({
  total,
  page,
  onPageChange,
}: CoordinatorReferralsPagerProps) {
  return (
    <Pagination currentPage={page} totalItems={total} onPageChange={onPageChange} />
  );
}
