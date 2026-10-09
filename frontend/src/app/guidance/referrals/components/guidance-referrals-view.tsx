"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RefreshBadge } from "@/components/ui/refresh-badge";
import { ZentraPageHeaderSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { GuidancePageHeader } from "../../components/GuidancePageHeader";
import { GuidanceEmptyCard } from "../../components/GuidanceEmptyCard";
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
import pageStyles from "../../pages.module.css";

const GUIDANCE_REFERRALS_PAGE_SIZE = 15;

export function GuidanceReferralsView({
  lockedType = "",
  title = "Referrals to me",
  description,
  highlightId = null,
}: {
  lockedType?: GuidanceTypeFilter;
  title?: string;
  description?: string;
  highlightId?: string | null;
}) {
  const locked = lockedType !== "";
  const { activeTerm, termReady } = useTerm();
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
    enabled: termReady,
  });

  const { data, isPending, isError, isRefetching, refetch } = referralsQuery;

  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const safePage = Math.min(data?.page ?? page, totalPages);

  const headerCopy = React.useMemo(() => {
    if (lockedType === "ADM")
      return {
        title,
        description:
          description ??
          "ADM cases endorsed to guidance — review, accept, or forward for action.",
      };
    if (lockedType === "Counseling")
      return {
        title,
        description:
          description ??
          "Counseling cases on your desk — accept a case to start work, resolve it when follow-through is done.",
      };
    return {
      title,
      description:
        description ??
        "Every behavior and incident report advisers routed to you. Accept a case to start work, resolve it when follow-through is done.",
    };
  }, [lockedType, title, description]);

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading your cases">
        <ZentraPageHeaderSkeleton />
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
  const unfilteredTotal = data.unfilteredTotal ?? data.total ?? 0;
  const isTrueEmpty =
    referrals.length === 0 &&
    unfilteredTotal === 0 &&
    debounced === "" &&
    action === "" &&
    (locked || typeFilter === "");

  return (
    <section
      className={isTrueEmpty ? `${styles.page} ${pageStyles.pageFit}` : styles.page}
      aria-busy={refreshing}
      aria-label={headerCopy.title}
    >
      {isTrueEmpty ? null : (
        <GuidancePageHeader
          title={headerCopy.title}
          description={headerCopy.description}
        />
      )}
      {refreshing ? <RefreshBadge label="Refreshing cases…" /> : null}
      {isTrueEmpty ? (
        <GuidanceEmptyCard
          icon={Inbox}
          title="No referrals found"
          hint="New cases sent to you by advisers will appear here."
          label={headerCopy.title}
          centered
          layout="fit"
        />
      ) : (
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
      )}
    </section>
  );
}
