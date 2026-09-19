"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchGuidanceReferrals } from "./guidance-referrals-data";
import { GuidanceReferralsTable } from "./guidance-referrals-table";
import { GuidanceReferralsSkeleton } from "./GuidanceReferralsSkeleton";
import {
  resolveActionParams,
  type GuidanceAction,
  type GuidanceTypeFilter,
} from "./guidance-referrals-format";
import styles from "./guidance-referrals.module.css";

const PAGE_SIZE = 50;

/**
 * Shared referrals view — the All page uses it unlocked (with the track
 * dropdown), while ADM Cases / Counseling Cases lock it to one track so
 * the reader never needs the dropdown.
 */
export function GuidanceReferralsView({
  lockedType = "",
  title = "Referrals to me",
}: {
  lockedType?: GuidanceTypeFilter;
  title?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<GuidanceTypeFilter>(lockedType);
  // Sidebar action (track + status + gates, server-side) mirroring the
  // nurse desk menus. Empty = no action filter.
  const [action, setAction] = React.useState<GuidanceAction>("");
  const [page, setPage] = React.useState(1);
  const [debouncedQuery, setDebouncedQuery] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

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

  const { data, isPending, isError, refetch, isRefetching, isFetching } = useQuery({
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
    queryFn: () =>
      fetchGuidanceReferrals({
        q: debouncedQuery || undefined,
        status: actionParams.status || undefined,
        type: effType || undefined,
        booked: actionParams.booked || undefined,
        completed: actionParams.completed || undefined,
        open: actionParams.open || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true">
        <GuidanceReferralsSkeleton />
      </section>
    );
  }

  if (isError || !data) {
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
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        totalPages={data.totalPages}
        onPageChange={setPage}
        query={query}
        onQueryChange={setQuery}
        typeFilter={typeFilter}
        onTypeChange={handleTypeChange}
        action={action}
        onActionChange={handleActionChange}
        onRetry={() => refetch()}
        isRetrying={isRefetching}
        isNavigating={isFetching && !isPending}
        lockType={lockedType !== ""}
        title={title}
      />
    </section>
  );
}
