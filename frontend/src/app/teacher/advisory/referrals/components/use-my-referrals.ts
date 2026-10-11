"use client";
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useTerm } from "@/lib/term/TermContext";
import { PAGE_SIZE } from "@/components/shared/pagination";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
import { useSearchParams } from "next/navigation";
export interface ReferralRow {
  id: string;
  studentName: string;
  lrn: string;
  targetRole: string;
  status:
    | "pending"
    | "in_progress"
    | "resolved"
    | "dismissed"
    | "escalated"
    | "info_requested"
    | "follow_up";
  referredAt: string;
  reason: string;
  timeline: { label: string; detail?: string | null; date: string }[];
  track: "adm" | "general";
  consultReviewer?: string | null;
  admStage?: string | null;
  observationDate?: string | null;
  meetingAttended?: boolean | null;
  lastMeetingAt?: string | null;
  hasHomeVisit?: boolean;
  admApproved?: boolean;
  admApprovedAt?: string | null;
  modulesSubmitted?: number;
  modulesTotal?: number;
  lastModuleAt?: string | null;
  devicesReturned?: number;
  certificationAt?: string | null;
  resolvedAt?: string | null;
}
export interface MyReferralsPage {
  referrals: ReferralRow[];
  total: number;
  unfilteredTotal: number;
  page: number;
  totalPages: number;
  pageSize: number;
}
export const TEACHER_REFERRALS_PAGE_SIZE = PAGE_SIZE;
export function useMyReferrals(highlightId: string | null) {
  const searchParams = useSearchParams();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [queryInput, setQueryInput] = React.useState(searchParams.get("q") ?? "");
  const query = useDebouncedValue(queryInput.trim(), 300);
  const pager = useUrlPager(0, {}, { searchParam: "q", extraParams: ["q"] });
  const page = pager.page;
  const setPage = pager.setPage;
  const [takeover, setTakeover] = React.useState(false);
  const debounced = query;

  // Sync debounced search to the URL and reset to page 1 when it changes.
  const firstSearchSync = React.useRef(true);
  React.useEffect(() => {
    if (firstSearchSync.current) {
      firstSearchSync.current = false;
      return;
    }
    pager.setFilters({ q: debounced || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const setQuery = React.useCallback((value: string) => {
    setQueryInput(value);
  }, []);
  const landing = !takeover && highlightId !== null;
  const referralsQuery = useQuery<MyReferralsPage>({
    queryKey: ["myReferrals", takeover || !landing ? page : 1, debounced, termKey, landing ? (highlightId ?? "") : ""],
    queryFn: async ({ signal }) => {
      const search = new URLSearchParams();
      if (debounced) search.set("q", debounced);
      search.set("page", String(takeover || !landing ? page : 1));
      search.set("pageSize", String(TEACHER_REFERRALS_PAGE_SIZE));
      if (landing && highlightId) search.set("highlight", highlightId);
      const { data } = await apiClient.get<
        MyReferralsPage | ReferralRow[] | { referrals: ReferralRow[] }
      >(`/api/referrals/mine${search.toString() ? `?${search.toString()}` : ""}`, {
        signal,
      });
      if (Array.isArray(data)) {
        return {
          referrals: data,
          total: data.length,
          unfilteredTotal: data.length,
          page,
          totalPages: 1,
          pageSize: TEACHER_REFERRALS_PAGE_SIZE,
        };
      }
      const referrals = Array.isArray(
        (data as { referrals?: unknown }).referrals
      )
        ? (data as { referrals: ReferralRow[] }).referrals
        : [];
      const fallback = data as Partial<MyReferralsPage>;
      const total = fallback.total ?? referrals.length;
      const unfilteredTotal = fallback.unfilteredTotal ?? referrals.length;
      const totalPages =
        fallback.totalPages ?? Math.max(1, Math.ceil(total / TEACHER_REFERRALS_PAGE_SIZE));
      return {
        referrals,
        total,
        unfilteredTotal,
        page: fallback.page ?? page,
        totalPages,
        pageSize: fallback.pageSize ?? TEACHER_REFERRALS_PAGE_SIZE,
      };
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
    gcTime: 5 * 60_000,
  });
  const totalPages = Math.max(1, referralsQuery.data?.totalPages ?? 1);
  const safePage = Math.min(referralsQuery.data?.page ?? page, totalPages);
  const goToPage = (next: number) => {
    setTakeover(true);
    setPage(next);
  };
  React.useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`teacher-referral-${highlightId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [highlightId, referralsQuery.data]);
  const referrals = React.useMemo(
    () =>
      Array.isArray(referralsQuery.data?.referrals)
        ? referralsQuery.data.referrals
        : [],
    [referralsQuery.data],
  );
  const total = referralsQuery.data?.total ?? referrals.length;
  const unfilteredTotal = referralsQuery.data?.unfilteredTotal ?? referrals.length;
  return {
    query: queryInput,
    setQuery,
    page,
    setPage,
    takeover,
    setTakeover,
    referralsQuery,
    totalPages,
    safePage,
    goToPage,
    referrals,
    total,
    unfilteredTotal,
  };
}
