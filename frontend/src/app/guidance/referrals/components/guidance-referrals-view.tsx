"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RefreshBadge } from "@/components/ui/refresh-badge";
import { fetchGuidanceReferrals, fetchAllGuidanceReferrals } from "./guidance-referrals-data";
import { GuidanceReferralsTable } from "./guidance-referrals-table";
import { GuidanceReferralsSkeleton } from "./GuidanceReferralsSkeleton";
import {
  buildGuidanceSummary,
  matchesGuidanceFilters,
  resolveActionParams,
  type GuidanceAction,
  type GuidanceTypeFilter,
} from "./guidance-referrals-format";
import styles from "./guidance-referrals.module.css";

const PAGE_SIZE = 10;

/**
 * Shared referrals view — the All page uses it unlocked (server-paged,
 * with the track dropdown), while ADM Cases / Counseling Cases lock it to
 * one track and scroll the full track list (same model as the nurse
 * timelines: one fetch, client-side filter, scroll hint, no pager).
 *
 * Deep-links from the alerts table pass `highlightId` (the table scrolls
 * to and highlights the case on arrival).
 */
export function GuidanceReferralsView({
  lockedType = "",
  title = "Referrals to me",
  highlightId = null,
}: {
  lockedType?: GuidanceTypeFilter;
  title?: string;
  highlightId?: string | null;
}) {
  const locked = lockedType !== "";
  const [query, setQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<GuidanceTypeFilter>(lockedType);
  // Sidebar action (track + status + gates, server-side) mirroring the
  // nurse desk menus. Empty = no action filter.
  const [action, setAction] = React.useState<GuidanceAction>("");
  const [page, setPage] = React.useState(1);
  const [debouncedQuery, setDebouncedQuery] = React.useState("");

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const handleQueryChange = (value: string) => {
    // Reset to page 1 synchronously so a pager click during the debounce
    // window isn't overwritten back when the timer fires.
    setQuery(value);
    setPage(1);
  };

  const handleTypeChange = (value: GuidanceTypeFilter) => {
    // Locked pages stay on their track — the dropdown is hidden, and
    // "Show all" restores the locked track rather than clearing it.
    if (lockedType !== "") return;
    setTypeFilter(value);
    // The sidebar menus are per-track — a stale action from the other
    // track would empty the list, so reset it.
    setAction("");
    setPage(1);
  };

  const handleActionChange = (value: GuidanceAction) => {
    setAction(value);
    setPage(1);
  };

  // One menu pick carries its own track; otherwise the type dropdown applies.
  const actionParams = resolveActionParams(action);
  const effType =
    action !== ""
      ? actionParams.type
      : typeFilter === "ADM"
        ? "adm"
        : typeFilter === "Counseling"
          ? "counseling"
          : "";
  const trackParam = lockedType === "ADM" ? "adm" : lockedType === "Counseling" ? "counseling" : "";

  // Locked pages: one full track fetch under the invalidated
  // ["guidance-referrals"] prefix, so realtime refetches the whole list.
  const trackQuery = useQuery({
    queryKey: ["guidance-referrals", "track", trackParam],
    queryFn: () => fetchAllGuidanceReferrals(trackParam ? { type: trackParam } : undefined),
    staleTime: 60_000,
    enabled: locked,
  });

  const serverQuery = useQuery({
    queryKey: [
      "guidance-referrals",
      {
        q: debouncedQuery,
        status: actionParams.status,
        type: effType,
        booked: actionParams.booked,
        completed: actionParams.completed,
        open: actionParams.open,
        page,
        pageSize: PAGE_SIZE,
      },
    ],
    queryFn: ({ signal }) =>
      fetchGuidanceReferrals(
        {
          q: debouncedQuery || undefined,
          status: actionParams.status || undefined,
          type: effType || undefined,
          booked: actionParams.booked || undefined,
          completed: actionParams.completed || undefined,
          open: actionParams.open || undefined,
          page,
          pageSize: PAGE_SIZE,
        },
        { signal }
      ),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    enabled: !locked,
  });

  // Locked mode: client filter + newest-first over the full track list.
  const trackRows = React.useMemo(() => {
    const all = trackQuery.data ?? [];
    const kept = all.filter((r) => matchesGuidanceFilters(r, debouncedQuery, actionParams));
    // Newest observed first — mirrors the endpoint's observationDatetime
    // ordering so realtime arrivals land on top with no refresh.
    kept.sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      return cmp !== 0 ? cmp : b.id.localeCompare(a.id);
    });
    return kept;
  }, [trackQuery.data, debouncedQuery, actionParams]);

  const trackSummary = React.useMemo(
    () => (locked ? buildGuidanceSummary(trackQuery.data ?? []) : null),
    [trackQuery.data, locked],
  );

  const isPending = locked ? trackQuery.isPending : serverQuery.isPending;
  const isError = locked ? trackQuery.isError : serverQuery.isError;
  const isRefetching = locked ? trackQuery.isRefetching : serverQuery.isRefetching;
  const refetch = locked ? trackQuery.refetch : serverQuery.refetch;

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true">
        <GuidanceReferralsSkeleton
          lockType={lockedType !== ""}
          menuRows={lockedType === "ADM" ? 6 : lockedType === "Counseling" ? 5 : undefined}
        />
      </section>
    );
  }

  if (isError) {
    return (
      <section className={styles.page}>
        <div className={styles.pageError} role="alert">
          <p className={styles.pageErrorTitle}>We couldn&apos;t load your cases</p>
          <p className={styles.pageErrorHint}>
            Please check your internet connection and try again.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={isRefetching}
            onClick={() => refetch()}
          >
            {isRefetching ? (
              <Loader2 className={styles.spin} aria-hidden="true" />
            ) : null}
            {isRefetching ? "Loading…" : "Try again"}
          </Button>
        </div>
      </section>
    );
  }

  if (locked) {
    const refreshing = trackQuery.isRefetching && !trackQuery.isPending;
    return (
      <section className={styles.page} aria-busy={refreshing}>
        {refreshing ? <RefreshBadge label="Refreshing cases…" /> : null}
        <GuidanceReferralsTable
          referrals={trackRows}
          summary={trackSummary}
          total={trackRows.length}
          query={query}
          onQueryChange={handleQueryChange}
          typeFilter={typeFilter}
          onTypeChange={handleTypeChange}
          action={action}
          onActionChange={handleActionChange}
          onRetry={() => refetch()}
          isRetrying={isRefetching}
          lockType
          paginate={false}
          title={title}
          highlightId={highlightId}
        />
      </section>
    );
  }

  const data = serverQuery.data;
  if (!data) {
    return (
      <section className={styles.page}>
        <div className={styles.pageError} role="alert">
          <p className={styles.pageErrorTitle}>We couldn&apos;t load your cases</p>
          <p className={styles.pageErrorHint}>
            Please check your internet connection and try again.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={isRefetching}
            onClick={() => refetch()}
          >
            {isRefetching ? (
              <Loader2 className={styles.spin} aria-hidden="true" />
            ) : null}
            {isRefetching ? "Loading…" : "Try again"}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <GuidanceReferralsTable
        referrals={data.referrals}
        summary={data.summary ?? null}
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        totalPages={data.totalPages}
        onPageChange={setPage}
        query={query}
        onQueryChange={handleQueryChange}
        typeFilter={typeFilter}
        onTypeChange={handleTypeChange}
        action={action}
        onActionChange={handleActionChange}
        onRetry={() => refetch()}
        isRetrying={isRefetching}
        isNavigating={serverQuery.isFetching && !serverQuery.isPending}
        lockType={false}
        title={title}
        highlightId={highlightId}
      />
    </section>
  );
}
