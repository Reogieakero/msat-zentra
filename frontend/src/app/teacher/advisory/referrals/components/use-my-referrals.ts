"use client";
import * as React from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useLiveQuery } from "@/lib/api/live";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useTerm } from "@/lib/term/TermContext";
import { PAGE_SIZE } from "@/components/shared/pagination";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
export interface ReferralRow {
  id: string;
  studentName: string;
  lrn: string;
  /** Persisted sprite mascot (StudentMascot pool); null falls back to the derived one. */
  mascot: string | null;
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
  anecdotalId: string | null;
  /** Role that dismissed the referral (audit-derived). Teacher roles mean
      the filer withdrew it; anything else means the desk rejected it. */
  dismissedByRole?: string | null;
  /** Latest desk/queue note persisted with the case (the dismissal reason
      lands here when a desk rejects or the filer withdraws it). */
  notes?: string | null;
  timeline: {
    label: string;
    detail?: string | null;
    /** Calendar date (YYYY-MM-DD) the step happened. */
    date: string;
    /** Full audit timestamp — the real moment the action ran. */
    at?: string;
    action?: string;
  }[];
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
  /** Booked-but-not-yet-held session on the case (guidance/nurse booked it). */
  bookedSession?: {
    scheduledAt: string;
    sessionType: string;
    venue: string | null;
  } | null;
}
export interface MyReferralsPage {
  referrals: ReferralRow[];
  total: number;
  unfilteredTotal: number;
  /** Server-clamped page (a `highlight` can land the row on a later page). */
  page?: number;
  pageSize?: number;
  totalPages?: number;
}
/** A dismissed referral counts as withdrawn by the filer when the
    dismissal actor is a teacher role (or unknown — both writers audit,
    so a missing actor predates the distinction). Anything else means the
    receiving desk rejected it. */
export function isWithdrawnDismissal(role?: string | null): boolean {
  return !role || role === "adviser" || role === "subject_teacher";
}
/**
 * Adviser referrals board: one server-paged slice of `/api/referrals/mine`
 * (15 per page, the shared list ceiling) with the page kept in the URL.
 * `placeholderData` holds the previous page while the next one loads so the
 * table can swap its rows for skeletons without collapsing the layout.
 */
export function useMyReferrals(highlightId: string | null) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [queryInput, setQueryInput] = React.useState(searchParams.get("q") ?? "");
  const debounced = useDebouncedValue(queryInput.trim(), 300);

  const pager = useUrlPager(0, {}, { searchParam: "q" });
  const page = pager.page;

  // A `?highlight=` landing (notification/deep link) pins the page that holds
  // the row, so the highlight wins over ?page until the user pages or searches.
  const highlight = highlightId ?? searchParams.get("highlight");

  // Keep ?q in the URL for refresh/back-forward; a changed search resets to
  // page 1 and drops the landing highlight.
  React.useEffect(() => {
    const wantedQ = debounced || "";
    const currentQ = searchParams.get("q") ?? "";
    if (wantedQ === currentQ) return;
    const params = new URLSearchParams(searchParams.toString());
    if (wantedQ) params.set("q", wantedQ);
    else params.delete("q");
    params.delete("page");
    params.delete("highlight");
    router.replace(
      params.toString() ? `${pathname}?${params.toString()}` : pathname,
      { scroll: false },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, searchParams]);

  const setQuery = React.useCallback((value: string) => {
    setQueryInput(value);
  }, []);

  const referralsQuery = useLiveQuery<MyReferralsPage>({
    queryKey: ["myReferrals", termKey, page, debounced, highlight ?? ""],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<
        MyReferralsPage | ReferralRow[] | { referrals: ReferralRow[] }
      >(`/api/referrals/mine`, {
        signal,
        params: {
          page,
          pageSize: PAGE_SIZE,
          ...(debounced ? { q: debounced } : {}),
          ...(highlight ? { highlight } : {}),
        },
      });
      if (Array.isArray(data)) {
        return {
          referrals: data,
          total: data.length,
          unfilteredTotal: data.length,
          page,
          pageSize: PAGE_SIZE,
          totalPages: 1,
        };
      }
      const referrals = Array.isArray(
        (data as { referrals?: unknown }).referrals
      )
        ? (data as { referrals: ReferralRow[] }).referrals
        : [];
      const body = data as Partial<MyReferralsPage>;
      return {
        referrals,
        total: body.total ?? referrals.length,
        unfilteredTotal: body.unfilteredTotal ?? referrals.length,
        page: body.page ?? page,
        pageSize: body.pageSize ?? PAGE_SIZE,
        totalPages: body.totalPages ?? 1,
      };
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
    gcTime: 5 * 60_000,
  });

  React.useEffect(() => {
    if (!highlight) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`teacher-referral-${highlight}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [highlight, referralsQuery.data]);

  const setPage = React.useCallback(
    (next: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(Math.max(1, Math.floor(next) || 1)));
      // Once the user pages, the landing highlight must stop pinning a page.
      params.delete("highlight");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const referrals = React.useMemo(
    () =>
      Array.isArray(referralsQuery.data?.referrals)
        ? referralsQuery.data.referrals
        : [],
    [referralsQuery.data],
  );
  const total = referralsQuery.data?.total ?? referrals.length;
  const unfilteredTotal =
    referralsQuery.data?.unfilteredTotal ?? referrals.length;
  return {
    query: queryInput,
    setQuery,
    referralsQuery,
    referrals,
    total,
    unfilteredTotal,
    // While the next page is loading, follow the URL immediately so the pager
    // reflects the click; otherwise use the server-clamped page (a highlight
    // can pin a different page than ?page).
    page: referralsQuery.isPlaceholderData
      ? page
      : (referralsQuery.data?.page ?? page),
    setPage,
  };
}
