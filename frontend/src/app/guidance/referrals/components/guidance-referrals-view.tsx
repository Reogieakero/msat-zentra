"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RefreshBadge } from "@/components/ui/refresh-badge";
import { fetchGuidanceReferrals } from "@/services/guidance/referrals.service";
import type { GuidanceReferralsData } from "@/services/guidance/guidance.types";
import { GuidanceReferralsTable } from "./guidance-referrals-table";
import { GuidanceReferralsSkeleton } from "./GuidanceReferralsSkeleton";
import {
  resolveActionParams,
  type GuidanceAction,
  type GuidanceTypeFilter,
} from "./guidance-referrals-format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useTerm } from "@/lib/term/TermContext";
import styles from "./guidance-referrals.module.css";

const GUIDANCE_REFERRALS_PAGE_SIZE = 15;

/**
 * Shared referrals view — the All page uses it unlocked (server-paged,
 * with the track dropdown), while ADM Cases / Counseling Cases lock it to
 * one track (server track-filtered + server-paginated, same model as the
 * nurse timelines).
 *
 * Deep-links pass `highlightId`: the backend serves the case's own page
 * (?highlight=) and the table scrolls to it; the first pager/filter touch
 * takes over with plain params. Derived — no setState in effects.
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
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [query, setQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<GuidanceTypeFilter>(lockedType);
  // Sidebar action (track + status + gates, server-side) mirroring the
  // nurse desk menus. Empty = no action filter.
  const [action, setAction] = React.useState<GuidanceAction>("");
  const [page, setPage] = React.useState(1);
  const [takeover, setTakeover] = React.useState(false);
  // Debounced 300ms so server queries fire after the user pauses typing.
  const debounced = useDebouncedValue(query.trim(), 300);
  const landing = !takeover && highlightId !== null;

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setTakeover(true);
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
    setTakeover(true);
    setPage(1);
  };

  const handleActionChange = (value: GuidanceAction) => {
    setAction(value);
    setTakeover(true);
    setPage(1);
  };

  const handlePageChange = (next: number) => {
    setTakeover(true);
    setPage(next);
  };

  // One menu pick carries its own track; otherwise the type dropdown applies.
  // Locked pages always use their own track.
  const actionParams = resolveActionParams(action);
  const effType =
    lockedType === "ADM"
      ? "adm"
      : lockedType === "Counseling"
        ? "counseling"
        : action !== ""
          ? actionParams.type
          : typeFilter === "ADM"
            ? "adm"
            : typeFilter === "Counseling"
              ? "counseling"
              : "";
  const statusParam = actionParams.status || undefined;
  const bookedParam = actionParams.booked || undefined;
  const completedParam = actionParams.completed || undefined;
  const openParam = actionParams.open || undefined;

  const queryKey = [
    "guidance-referrals",
    takeover || !locked ? page : 1,
    debounced,
    statusParam ?? "",
    effType,
    bookedParam ?? false,
    completedParam ?? false,
    openParam ?? false,
    termKey,
    landing ? (highlightId ?? "") : "",
  ];

  const referralsQuery = useQuery<GuidanceReferralsData>({
    queryKey,
    queryFn: ({ signal }) =>
      fetchGuidanceReferrals(
        {
          q: debounced || undefined,
          status: statusParam,
          type: effType || undefined,
          booked: bookedParam,
          completed: completedParam,
          open: openParam,
          page: takeover || !locked ? page : 1,
          pageSize: GUIDANCE_REFERRALS_PAGE_SIZE,
          ...(landing && highlightId ? { highlight: highlightId } : {}),
        },
        { signal }
      ),
    // Page turns reuse the previous page so they never flash skeletons.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const { data, isPending, isError, isRefetching, refetch } = referralsQuery;

  // Derived, never setState-in-effect: the server clamps too, this keeps
  // the pager truthful while a filter shrinks the list under the cursor.
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const safePage = Math.min(data?.page ?? page, totalPages);

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

  const refreshing = isRefetching && !isPending;
  const referrals = Array.isArray(data.referrals) ? data.referrals : [];

  return (
    <section className={styles.page} aria-busy={refreshing}>
      {refreshing ? <RefreshBadge label="Refreshing cases…" /> : null}
      <GuidanceReferralsTable
        referrals={referrals}
        summary={data.summary ?? null}
        total={data.total}
        unfilteredTotal={data.unfilteredTotal}
        page={safePage}
        pageSize={data.pageSize}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        query={query}
        onQueryChange={handleQueryChange}
        typeFilter={typeFilter}
        onTypeChange={handleTypeChange}
        action={action}
        onActionChange={handleActionChange}
        onRetry={() => refetch()}
        isRetrying={isRefetching}
        isNavigating={isRefetching && !isPending}
        lockType={locked}
        title={title}
        highlightId={highlightId}
      />
    </section>
  );
}
