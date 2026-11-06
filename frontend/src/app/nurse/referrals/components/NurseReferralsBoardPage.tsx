"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Inbox, Loader2 } from "lucide-react";
import { NurseEmptyCard } from "../../components/NurseEmptyCard";
import { NurseAlertsTable } from "./NurseAlertsTable";
import { NurseReferralsSkeleton } from "./NurseReferralsSkeleton";
import { fetchNurseAlerts } from "@/services/nurse/alerts.service";
import type { NurseAlertsPage } from "@/services/nurse/nurse.types";
import { useNurseInvalidate } from "../../overview/components/use-nurse-mutation";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useTerm } from "@/lib/term/TermContext";
import styles from "../nurse-referrals-page.module.css";
import pageStyles from "../../pages.module.css";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
import type { TypeFilter } from "./nurse-referrals-format";

/** Both nurse case desks page in whole 4×4 kanban grids (four rows of four). */
const NURSE_BOARD_PAGE_SIZE = 16;

type BoardTrack = "adm" | "clinic";

const COPY: Record<
  BoardTrack,
  {
    initialType: TypeFilter;
    loadingLabel: string;
    errorTitle: string;
    ariaLabel: string;
    emptyTitle: string;
    emptyHint: string;
    emptyLabel: string;
    boardTitle: string;
    searchPlaceholder: string;
    /** ADM cases open the referral form behind ?form=1; clinic has none. */
    autoOpenForm: boolean;
  }
> = {
  adm: {
    initialType: "ADM",
    loadingLabel: "Loading ADM cases",
    errorTitle: "We couldn't load your ADM cases",
    ariaLabel: "ADM cases",
    emptyTitle: "No ADM cases",
    emptyHint: "New ADM cases sent to you will appear here.",
    emptyLabel: "ADM cases",
    boardTitle: "ADM Cases",
    searchPlaceholder: "Search ADM cases…",
    autoOpenForm: true,
  },
  clinic: {
    initialType: "Clinic",
    loadingLabel: "Loading clinic matters",
    errorTitle: "We couldn't load your clinic matters",
    ariaLabel: "Clinic matters",
    emptyTitle: "No clinic matters",
    emptyHint: "New clinic cases sent to you will appear here.",
    emptyLabel: "Clinic matters",
    boardTitle: "Clinic Matters",
    searchPlaceholder: "Search clinic cases…",
    autoOpenForm: false,
  },
};

/**
 * Shared nurse case board (/nurse/referrals/adm and /nurse/referrals/clinic):
 * one server-paged kanban grid with live search, so both desks stay
 * identical apart from their copy and track filter.
 */
function NurseReferralsBoard({ track }: { track: BoardTrack }) {
  const copy = COPY[track];
  const params = useSearchParams();
  const highlightId = params.get("highlight");
  const autoViewFormId =
    copy.autoOpenForm && params.get("form") === "1" ? params.get("highlight") : null;
  const invalidateNurse = useNurseInvalidate();
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [queryInput, setQueryInput] = React.useState(params.get("q") ?? "");
  const pager = useUrlPager(0, {}, { searchParam: "q" });
  const page = pager.page;
  const setPage = pager.setPage;
  const [takeover, setTakeover] = React.useState(false);
  const landing = !takeover && highlightId !== null;
  const requestedPage = takeover ? page : 1;

  const query = useDebouncedValue(queryInput.trim(), 300);

  // Sync the debounced search to the URL and reset to page 1 when it changes.
  const firstSearchSync = React.useRef(true);
  React.useEffect(() => {
    if (firstSearchSync.current) {
      firstSearchSync.current = false;
      return;
    }
    setTakeover(true);
    pager.setFilters({ q: query || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const { data, isPending, isError, refetch, isRefetching } =
    useQuery<NurseAlertsPage>({
      queryKey: [
        "nurse-alerts",
        track,
        requestedPage,
        termKey,
        landing ? (highlightId ?? "") : "",
        query,
      ],
      queryFn: ({ signal }) =>
        fetchNurseAlerts({
          q: query || undefined,
          track,
          page: requestedPage,
          pageSize: NURSE_BOARD_PAGE_SIZE,
          ...(landing && highlightId ? { highlight: highlightId } : {}),
          signal,
        }),
      // Page flips drop the retained page so the skeleton shows while the
      // next payload loads; a same-page search refresh keeps the rows so
      // typing never blanks the board.
      placeholderData: (previousData, previousQuery) =>
        previousData && previousQuery?.queryKey?.[2] === requestedPage
          ? previousData
          : undefined,
      staleTime: 60_000,
      enabled: termReady,
    });

  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const safePage = Math.min(data?.page ?? page, totalPages);

  function refresh() {
    invalidateNurse();
  }

  /* First load and page flips show the skeleton: page changes drop the
     retained page (see `placeholderData`), so `isPending` covers navigation.
     Same-page search refreshes keep the cards and only flag `aria-busy`. */
  if (isPending) {
    return (
      <section
        className={styles.page}
        aria-busy="true"
        aria-label={copy.loadingLabel}
      >
        <NurseReferralsSkeleton sideRows={6} />
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <div className={styles.pageError} role="alert">
          <p className={styles.pageErrorTitle}>{copy.errorTitle}</p>
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
            Try again
          </Button>
        </div>
      </section>
    );
  }

  const refreshing = isRefetching && !isPending;
  const isTrueEmpty = (data.unfilteredTotal ?? data.total) === 0;

  return (
    <section
      className={isTrueEmpty ? `${styles.page} ${pageStyles.pageFit}` : styles.page}
      aria-busy={refreshing}
      aria-label={copy.ariaLabel}
    >
      {isTrueEmpty ? (
        <NurseEmptyCard
          icon={Inbox}
          title={copy.emptyTitle}
          hint={copy.emptyHint}
          label={copy.emptyLabel}
          centered
          layout="fit"
        />
      ) : (
        <NurseAlertsTable
          alerts={Array.isArray(data.alerts) ? data.alerts : []}
          onChanged={refresh}
          initialType={copy.initialType}
          lockType
          layout="kanban"
          pageSize={NURSE_BOARD_PAGE_SIZE}
          title={copy.boardTitle}
          highlightId={highlightId}
          autoViewFormId={autoViewFormId}
          serverPage={safePage}
          serverTotalPages={totalPages}
          serverTotal={data.total}
          serverUnfilteredTotal={data.unfilteredTotal}
          onServerPageChange={(p) => {
            setTakeover(true);
            setPage(p);
          }}
          search={queryInput}
          onSearchChange={setQueryInput}
          searchPlaceholder={copy.searchPlaceholder}
        />
      )}
    </section>
  );
}

/** Page shell for one nurse case desk — Suspense wrapper included. */
export function NurseReferralsBoardPage({ track }: { track: BoardTrack }) {
  return (
    <React.Suspense
      fallback={
        <section className={styles.page}>
          <NurseReferralsSkeleton sideRows={6} />
        </section>
      }
    >
      <NurseReferralsBoard track={track} />
    </React.Suspense>
  );
}
