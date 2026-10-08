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

  const [action, setAction] = React.useState<GuidanceAction>("");
  const [page, setPage] = React.useState(1);
  const [takeover, setTakeover] = React.useState(false);

  const debounced = useDebouncedValue(query.trim(), 300);
  const landing = !takeover && highlightId !== null;

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setTakeover(true);
    setPage(1);
  };

  const handleTypeChange = (value: GuidanceTypeFilter) => {

    if (lockedType !== "") return;
    setTypeFilter(value);

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

    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const { data, isPending, isError, isRefetching, refetch } = referralsQuery;

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
