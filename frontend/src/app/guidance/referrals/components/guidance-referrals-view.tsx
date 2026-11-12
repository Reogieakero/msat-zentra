"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZentraPageHeaderSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { GuidancePageHeader } from "../../components/GuidancePageHeader";
import { GuidanceEmptyCard } from "../../components/GuidanceEmptyCard";
import { fetchGuidanceReferrals } from "@/services/guidance/referrals.service";
import type { GuidanceReferralsData } from "@/services/guidance/guidance.types";
import { GuidanceReferralsTable } from "./guidance-referrals-table";
import { GuidanceReferralsSkeleton } from "./GuidanceReferralsSkeleton";
import {
  buildGuidanceSummary,
  matchesGuidanceFilters,
  resolveActionParams,
  type GuidanceAction,
  type GuidanceTypeFilter,
} from "./guidance-referrals-format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useTerm } from "@/lib/term/TermContext";
import { liveQueryOptions } from "@/lib/api/live";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
import { useSearchParams } from "next/navigation";
import styles from "./guidance-referrals.module.css";
import pageStyles from "../../pages.module.css";
import { PAGE_SIZE } from "@/components/shared/pagination";

const GUIDANCE_REFERRALS_PAGE_SIZE = PAGE_SIZE;
/* The locked desk boards page in whole 4×4 kanban grids (four rows of
   four), same as the nurse ADM / clinic boards. */
const GUIDANCE_BOARD_PAGE_SIZE = 16;

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
  const isKanban =
    lockedType === "ADM" || lockedType === "Counseling";
  const pageSize = isKanban ? GUIDANCE_BOARD_PAGE_SIZE : GUIDANCE_REFERRALS_PAGE_SIZE;
  const searchParams = useSearchParams();
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [queryInput, setQueryInput] = React.useState(searchParams.get("q") ?? "");
  const query = useDebouncedValue(queryInput.trim(), 300);
  const [typeFilter, setTypeFilter] = React.useState<GuidanceTypeFilter>(lockedType);

  const [action, setAction] = React.useState<GuidanceAction>("");
  const pager = useUrlPager(0, {}, { searchParam: "q", extraParams: ["q"] });
  const page = pager.page;
  const setPage = pager.setPage;
  const [takeover, setTakeover] = React.useState(false);

  // Sync debounced search to the URL and reset to page 1 when it changes.
  const firstSearchSync = React.useRef(true);
  React.useEffect(() => {
    if (firstSearchSync.current) {
      firstSearchSync.current = false;
      return;
    }
    pager.setFilters({ q: query || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const setQuery = React.useCallback((value: string) => {
    setQueryInput(value);
  }, []);
  const debounced = query;
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
        : typeFilter === "ADM"
          ? "adm"
          : typeFilter === "Counseling"
            ? "counseling"
            : "";

  /* Action tabs filter the already-loaded page, exactly like the nurse ADM
     board: no refetch, no stale board. Only the type + search hit the API. */
  const requestedPage = takeover || !locked ? page : 1;
  const queryKey = [
    "guidance-referrals",
    requestedPage,
    debounced,
    effType,
    termKey,
    landing ? (highlightId ?? "") : "",
  ];

  const referralsQuery = useQuery<GuidanceReferralsData>({
    ...liveQueryOptions,
    queryKey,
    queryFn: ({ signal }) =>
      fetchGuidanceReferrals(
        {
          q: debounced || undefined,
          type: effType || undefined,
          page: requestedPage,
          pageSize,
          ...(landing && highlightId ? { highlight: highlightId } : {}),
        },
        { signal }
      ),

    // Same-page refreshes (typing) keep the cards; a page flip drops the
    // retained page so the skeleton shows while the next payload loads.
    placeholderData: (previousData, previousQuery) =>
      previousData && previousQuery?.queryKey?.[1] === requestedPage
        ? previousData
        : undefined,
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
        {isKanban ? (
          <GuidanceReferralsSkeleton lockType />
        ) : (
          <>
            <ZentraPageHeaderSkeleton />
            <GuidanceReferralsSkeleton lockType={false} />
          </>
        )}
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
  const loadedReferrals = Array.isArray(data.referrals) ? data.referrals : [];
  const hasActionFilter = action !== "";
  /* Search types instantly over the loaded page (the debounced server query
     catches up in the background); action tabs narrow the same slice. */
  const liveQuery = queryInput.trim();
  const referrals =
    hasActionFilter || liveQuery !== ""
      ? loadedReferrals.filter((row) =>
          matchesGuidanceFilters(row, liveQuery, actionParams)
        )
      : loadedReferrals;
  const unfilteredTotal = data.unfilteredTotal ?? data.total ?? 0;
  /* Tab badges count the loaded page, exactly like the nurse board — a
     desk-wide count would advertise a case this page cannot show. */
  const pageSummary = buildGuidanceSummary(loadedReferrals);
  const isTrueEmpty =
    loadedReferrals.length === 0 &&
    unfilteredTotal === 0 &&
    debounced === "" &&
    action === "" &&
    (locked || typeFilter === "");
  /* While an action lens is on, report the filtered slice — never a stale
     server total for rows the board is not showing. */
  const displayTotal = hasActionFilter ? referrals.length : data.total;
  const displayPage = hasActionFilter ? 1 : safePage;
  const displayPageSize = hasActionFilter
    ? Math.max(referrals.length, 1)
    : data.pageSize;
  const displayTotalPages = hasActionFilter ? 1 : totalPages;

  return (
    <section
      className={isTrueEmpty ? `${styles.page} ${pageStyles.pageFit}` : styles.page}
      aria-busy={refreshing}
      aria-label={headerCopy.title}
    >
      {isTrueEmpty || isKanban ? null : (
        <GuidancePageHeader
          title={headerCopy.title}
          description={headerCopy.description}
        />
      )}
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
        summary={pageSummary}
        total={displayTotal}
        unfilteredTotal={data.unfilteredTotal}
        page={displayPage}
        pageSize={displayPageSize}
        totalPages={displayTotalPages}
        onPageChange={handlePageChange}
        query={queryInput}
        onQueryChange={handleQueryChange}
        typeFilter={typeFilter}
        onTypeChange={handleTypeChange}
        action={action}
        onActionChange={handleActionChange}
        onRetry={() => refetch()}
        isRetrying={isRefetching}
        lockType={locked}
        title={title}
        layout={isKanban ? "kanban" : "list"}
        highlightId={highlightId}
      />
      )}
    </section>
  );
}
