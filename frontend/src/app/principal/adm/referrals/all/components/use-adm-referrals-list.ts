"use client";
import * as React from "react";
import { fetchAdmReferrals } from "@/services/principal/adm.service";
import type { AdmReferralRow } from "@/services/principal/adm.types";
import { useMinLoading } from "../../../useMinLoading";
const PAGE_SIZE = 20;
export function useAdmReferralsList(search: string, page: number) {
  const [rows, setRows] = React.useState<AdmReferralRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [stage] = React.useState<string>("principal_approval");
  const [loading, setLoading] = useMinLoading(600);
  const [error, setError] = React.useState<string | null>(null);
  const load = React.useCallback(
    (p: number, signal?: AbortSignal) => {
      setLoading(true);
      return fetchAdmReferrals(
        p,
        PAGE_SIZE,
        signal,
        search.trim(),
        stage === "all" ? "" : stage,
      )
        .then((data) => {
          if (!data) return;
          setError(null);
          setRows(Array.isArray(data.rows) ? data.rows : []);
          setTotal(
            typeof data.total === "number" ? data.total : data.rows.length,
          );
          setCurrentPage(typeof data.page === "number" ? data.page : p);
        })
        .catch((err: unknown) => {
          if ((err as { code?: string })?.code === "ERR_CANCELED") return;
          setError("Failed to load referrals");
          console.error("[/api/adm/referrals] fetch failed:", err);
        })
        .finally(() => setLoading(false));
    },
    [search, stage, setLoading],
  );
  React.useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => load(1, controller.signal), 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [load]);
  const totalCount = total;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, totalCount);
  return {
    rows,
    setRows,
    total,
    totalCount,
    totalPages,
    safePage,
    start,
    end,
    pageSize: PAGE_SIZE,
    page: currentPage,
    loading,
    error,
    load,
    stage,
  };
}
