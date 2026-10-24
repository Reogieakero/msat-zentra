"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { BellRing, Loader2 } from "lucide-react";
import { NurseEmptyCard } from "../components/NurseEmptyCard";
import {
  NurseAlertsBoard,
  NurseAlertsBoardSkeleton,
  type TypeTrack,
} from "./components/NurseAlertsBoard";
import { fetchNurseAlerts } from "@/services/nurse/alerts.service";
import { fetchNurseRiskLevels } from "@/services/nurse/risk.service";
import type {
  NurseAlertsPage,
  NurseRiskLevel,
} from "@/services/nurse/nurse.types";
import { useNurseInvalidate } from "../overview/components/use-nurse-mutation";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useTerm } from "@/lib/term/TermContext";
import styles from "./components/nurse-alerts.module.css";
import pageStyles from "../pages.module.css";
import { PAGE_SIZE } from "@/components/shared/pagination";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
import { useSearchParams } from "next/navigation";

const NURSE_ALERTS_PAGE_SIZE = PAGE_SIZE;

export default function NurseAlertsPage() {
  return (
    <React.Suspense>
      <NurseAlertsPageInner />
    </React.Suspense>
  );
}

function NurseAlertsPageInner() {
  const searchParams = useSearchParams();
  const invalidateNurse = useNurseInvalidate();
  const queryClient = useQueryClient();
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [queryInput, setQueryInput] = React.useState(searchParams.get("q") ?? "");
  const pager = useUrlPager(0, {}, { searchParam: "q", extraParams: ["q", "track"] });
  const page = pager.page;
  const setPage = pager.setPage;
  const trackRaw = pager.extras.track;
  const track: TypeTrack =
    trackRaw === "adm" || trackRaw === "clinic" ? trackRaw : "";

  const query = useDebouncedValue(queryInput.trim(), 300);
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

  const { data, isPending, isError, refetch, isFetching } =
    useQuery<NurseAlertsPage>({
      queryKey: ["nurse-alerts", page, debounced, track, termKey],
      queryFn: ({ signal }) =>
        fetchNurseAlerts({
          q: debounced || undefined,
          track: track || undefined,
          page,
          pageSize: NURSE_ALERTS_PAGE_SIZE,
          signal,
        }),

      // Pagination (page/track changes) shows the kanban skeleton until its own
      // payload lands; a same-page search refresh keeps the previous rows so
      // typing doesn't flash the whole board. The next page is prefetched
      // below, so most page flips resolve straight from cache.
      placeholderData: (previousData, previousQuery) => {
        const key = previousQuery?.queryKey;
        const samePage = key?.[1] === page;
        const sameTrack = (key?.[3] ?? "") === track;
        return previousData && samePage && sameTrack ? previousData : undefined;
      },
      staleTime: 60_000,
      enabled: termReady,
    });

  // Warm the next page's cache as soon as a page resolves — low-latency pager.
  React.useEffect(() => {
    if (!data || !termReady) return;
    const next = page + 1;
    if (next > (data.totalPages ?? 1)) return;
    void queryClient.prefetchQuery({
      queryKey: ["nurse-alerts", next, debounced, track, termKey],
      queryFn: ({ signal }) =>
        fetchNurseAlerts({
          q: debounced || undefined,
          track: track || undefined,
          page: next,
          pageSize: NURSE_ALERTS_PAGE_SIZE,
          signal,
        }),
      staleTime: 60_000,
    });
  }, [data, page, queryClient, debounced, track, termKey, termReady]);

  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const safePage = Math.min(page, totalPages);

  const studentIds = React.useMemo(
    () => [
      ...new Set(
        (data?.alerts ?? [])
          .map((a) => a.studentId)
          .filter((id): id is string => id !== null)
      ),
    ].sort(),
    [data]
  );
  const {
    data: riskByStudent,
    isPending: riskPending,
    isFetching: riskFetching,
    isError: riskError,
    refetch: refetchRisk,
  } = useQuery<Record<string, NurseRiskLevel>>({
    queryKey: ["nurse-risk-levels", studentIds, termKey],
    queryFn: () => fetchNurseRiskLevels(studentIds),
    staleTime: 300_000,
    enabled: termReady && studentIds.length > 0,
  });
  const riskLoading = studentIds.length > 0 && (riskPending || riskFetching);

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading referred cases">
        <NurseAlertsBoardSkeleton />
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <div className={styles.pageError} role="alert">
          <p className={styles.pageErrorTitle}>We couldn&apos;t load the referred cases</p>
          <p className={styles.pageErrorHint}>
            Please check your internet connection and try again.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            {isFetching ? (
              <Loader2 className={styles.spin} aria-hidden="true" />
            ) : null}
            Try again
          </Button>
        </div>
      </section>
    );
  }

  const refreshing = isFetching && !isPending;
  // unfilteredTotal already carries the track filter, so a type filter that
  // matches nothing must NOT collapse to the centered empty card — the board
  // (with its filter icons) has to stay on screen to be clearable.
  const isTrueEmpty =
    (data.unfilteredTotal ?? data.total) === 0 &&
    data.total === 0 &&
    debounced === "" &&
    track === "";

  return (
    <section
      className={isTrueEmpty ? `${styles.page} ${pageStyles.pageFit}` : styles.page}
      aria-busy={refreshing}
      aria-label="Referred cases"
    >
      {riskError && studentIds.length > 0 ? (
        <p role="alert" style={{ margin: 0, fontSize: "0.8125rem", color: "var(--destructive)" }}>
          Risk levels couldn&apos;t load.{" "}
          <button
            type="button"
            onClick={() => refetchRisk()}
            disabled={riskFetching}
            style={{ textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit" }}
          >
            {riskFetching ? "Retrying…" : "Retry"}
          </button>
        </p>
      ) : null}
      {isTrueEmpty ? (
        <NurseEmptyCard
          icon={BellRing}
          title="No referred cases"
          hint="New ADM and clinic cases will appear here."
          label="Referred cases"
          centered
          layout="fit"
        />
      ) : (
        <NurseAlertsBoard
          alerts={Array.isArray(data.alerts) ? data.alerts : []}
          riskByStudent={riskByStudent ?? {}}
          riskLoading={riskLoading}
          query={queryInput}
          onQueryChange={(v) => {
            setQueryInput(v);
          }}
          track={track}
          onTrackChange={(next) => {
            pager.setFilters({ track: next || undefined });
          }}
          page={safePage}
          total={data.total}
          unfilteredTotal={data.unfilteredTotal}
          onPageChange={setPage}
          serverPaged
          onChanged={() => {
            invalidateNurse();
          }}
        />
      )}
    </section>
  );
}
