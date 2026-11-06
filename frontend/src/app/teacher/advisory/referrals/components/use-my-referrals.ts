"use client";
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useTerm } from "@/lib/term/TermContext";
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
}
/** A dismissed referral counts as withdrawn by the filer when the
    dismissal actor is a teacher role (or unknown — both writers audit,
    so a missing actor predates the distinction). Anything else means the
    receiving desk rejected it. */
export function isWithdrawnDismissal(role?: string | null): boolean {
  return !role || role === "adviser" || role === "subject_teacher";
}
export function useMyReferrals(highlightId: string | null) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [queryInput, setQueryInput] = React.useState(searchParams.get("q") ?? "");
  const debounced = useDebouncedValue(queryInput.trim(), 300);

  // Keep ?q in the URL for refresh/back-forward without any ?page param.
  // Also strips the legacy ?page param left over from the old paged view.
  React.useEffect(() => {
    const wantedQ = debounced || "";
    const currentQ = searchParams.get("q") ?? "";
    const hasPage = searchParams.has("page");
    if (!hasPage && wantedQ === currentQ) return;
    const params = new URLSearchParams(searchParams.toString());
    if (wantedQ) params.set("q", wantedQ);
    else params.delete("q");
    params.delete("page");
    router.replace(
      params.toString() ? `${pathname}?${params.toString()}` : pathname,
      { scroll: false },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, searchParams]);

  const setQuery = React.useCallback((value: string) => {
    setQueryInput(value);
  }, []);
  // No pagination params: the backend returns the full list when no
  // page/pageSize/q/highlight params are sent, and the kanban filters
  // client-side so every referral stays visible on one screen.
  const referralsQuery = useQuery<MyReferralsPage>({
    queryKey: ["myReferrals", termKey],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<
        MyReferralsPage | ReferralRow[] | { referrals: ReferralRow[] }
      >(`/api/referrals/mine`, {
        signal,
      });
      if (Array.isArray(data)) {
        return {
          referrals: data,
          total: data.length,
          unfilteredTotal: data.length,
        };
      }
      const referrals = Array.isArray(
        (data as { referrals?: unknown }).referrals
      )
        ? (data as { referrals: ReferralRow[] }).referrals
        : [];
      const fallback = data as Partial<MyReferralsPage>;
      return {
        referrals,
        total: fallback.total ?? referrals.length,
        unfilteredTotal: fallback.unfilteredTotal ?? referrals.length,
      };
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
    gcTime: 5 * 60_000,
  });
  React.useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`teacher-referral-${highlightId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [highlightId, referralsQuery.data]);
  const allReferrals = React.useMemo(
    () =>
      Array.isArray(referralsQuery.data?.referrals)
        ? referralsQuery.data.referrals
        : [],
    [referralsQuery.data],
  );
  const needle = queryInput.trim().toLowerCase();
  const referrals = React.useMemo(() => {
    if (!needle) return allReferrals;
    return allReferrals.filter((r) => {
      const displayStatus =
        r.status === "dismissed" ? (isWithdrawnDismissal(r.dismissedByRole) ? "cancelled" : "rejected") : "";
      return [r.studentName, r.lrn, r.reason, r.status, displayStatus, r.targetRole]
        .filter((v): v is string => typeof v === "string")
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [allReferrals, needle]);
  const total = referrals.length;
  const unfilteredTotal =
    referralsQuery.data?.unfilteredTotal ?? allReferrals.length;
  return {
    query: queryInput,
    setQuery,
    referralsQuery,
    referrals,
    total,
    unfilteredTotal,
  };
}
