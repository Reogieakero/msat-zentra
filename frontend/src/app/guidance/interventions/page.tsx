"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { HeartHandshake, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ZentraPageHeaderSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { GuidancePageHeader } from "../components/GuidancePageHeader";
import { GuidanceEmptyCard } from "../components/GuidanceEmptyCard";
import { fetchAllGuidanceInterventions, fetchGuidanceInterventions } from "@/services/guidance/interventions.service";
import type {
  GuidanceInterventionsData,
  RiskLevelFilter,
} from "@/services/guidance/interventions.types";
import {
  GuidanceInterventionsTable,
} from "./components/guidance-interventions-table";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useTerm } from "@/lib/term/TermContext";
import styles from "./components/guidance-interventions.module.css";

const GUIDANCE_INTERVENTIONS_PAGE_SIZE = 15;

function GuidanceInterventionsView({ highlightId }: { highlightId: string | null }) {
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const landing = highlightId !== null;
  const [query, setQuery] = React.useState("");
  const [level, setLevel] = React.useState<RiskLevelFilter>(landing ? "All" : "High");
  const [page, setPage] = React.useState(1);
  const [takeover, setTakeover] = React.useState(false);
  const [locatedFor, setLocatedFor] = React.useState<string | null>(null);

  const debounced = useDebouncedValue(query.trim(), 300);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setTakeover(true);
    setPage(1);
  };

  const handleLevelChange = (value: RiskLevelFilter) => {
    setLevel(value);
    setTakeover(true);
    setPage(1);
  };

  const handlePageChange = (next: number) => {
    setTakeover(true);
    setPage(next);
  };

  const {
    data,
    isPending,
    isError,
    refetch,
    isRefetching,
    isPlaceholderData,
  } = useQuery<GuidanceInterventionsData>({
      queryKey: ["guidance-interventions", takeover || !landing ? page : 1, debounced, takeover || !landing ? level : "All", termKey],
      queryFn: ({ signal }) =>
        fetchGuidanceInterventions(
          {
            q: debounced || undefined,
            level: takeover || !landing ? level : "All",
            outcome: "all",
            page: takeover || !landing ? page : 1,
            pageSize: GUIDANCE_INTERVENTIONS_PAGE_SIZE,
          },
          { signal }
        ),

      placeholderData: keepPreviousData,
      staleTime: 60_000,
      enabled: termReady,
    });

  // Locate the highlighted student across the cohort (level=All) and jump
  // to its server page. Runs once per highlight until the user takes over.
  const locateQuery = useQuery({
    queryKey: ["guidance-interventions-locate", highlightId, termKey],
    queryFn: fetchAllGuidanceInterventions,
    staleTime: 60_000,
    enabled: termReady && landing && !takeover && !!highlightId && locatedFor !== highlightId,
  });
  React.useEffect(() => {
    if (!landing || takeover || !highlightId || locatedFor === highlightId) return;
    const all = locateQuery.data;
    if (!all) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deep-link landing sync
    setLocatedFor(highlightId);
    const idx = all.findIndex((s) => s.studentKey === highlightId);
    if (idx >= 0) {
      setPage(Math.floor(idx / GUIDANCE_INTERVENTIONS_PAGE_SIZE) + 1);
    }
    setTakeover(true);
  }, [landing, takeover, highlightId, locatedFor, locateQuery.data]);

  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const safePage = Math.min(data?.page ?? page, totalPages);

  return (
    <section className={styles.page} aria-busy={isPending || undefined}>
      {isPending ? (
        <>
          <ZentraPageHeaderSkeleton />
          <div aria-busy="true" className={styles.feed}>
          <div className={styles.skelToolbar}>
            <div className={styles.skelHeadText}>
              <Skeleton className={styles.skelTitle} />
              <Skeleton className={styles.skelDesc} />
            </div>
            <Skeleton className={styles.skelSearch} />
          </div>
          <div className={styles.skelTableWrap}>
            <div className={styles.skelTable}>
              <div className={styles.skelHeadRow}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className={styles.skelCell}>
                    <Skeleton
                      className={styles.skelBar}
                      style={{ width: i % 3 === 0 ? "70%" : "45%" }}
                    />
                  </div>
                ))}
              </div>
              {[0, 1, 2, 3, 4].map((row) => (
                <div key={row} className={styles.skelRow}>
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((cell) => (
                    <div key={cell} className={styles.skelCell}>
                      <Skeleton
                        className={styles.skelBar}
                        style={{ width: cell % 3 === 0 ? "70%" : "45%" }}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.skelPager}>
            <Skeleton className={styles.skelRange} />
            <div className={styles.skelPagerBtns}>
              <Skeleton className={styles.skelPageBtn} />
              <Skeleton className={styles.skelPageLabel} />
              <Skeleton className={styles.skelPageBtn} />
            </div>
          </div>
          </div>
        </>
      ) : isError || !data ? (
        <div className={styles.empty} role="alert">
          <p className={styles.emptyTitle}>We couldn&apos;t load the queue</p>
          <p className={styles.emptyHint}>
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
      ) : (data.unfilteredTotal ?? data.total) === 0 && query.trim() === "" ? (
        <GuidanceEmptyCard
          icon={HeartHandshake}
          title="No intervention cases"
          hint="At-risk students needing guidance follow-up will appear here."
          label="Intervention cases"
          centered
        />
      ) : (
        <>
          <GuidancePageHeader
            title="Interventions"
            description="High-risk students on the guidance desk — start, schedule, or close follow-through."
          />
          <GuidanceInterventionsTable
            summary={data.summary}
            students={Array.isArray(data.students) ? data.students : []}
            page={safePage}
            pageSize={data.pageSize}
            total={data.total}
            totalPages={totalPages}
            unfilteredTotal={data.unfilteredTotal}
            onPageChange={handlePageChange}
            query={query}
            onQueryChange={handleQueryChange}
            level={takeover || !landing ? level : "All"}
            onLevelChange={handleLevelChange}
            onRetry={() => refetch()}
            isRetrying={isRefetching}
            isNavigating={isPlaceholderData}
            highlightId={highlightId}
          />
        </>
      )}
    </section>
  );
}

export default function GuidanceInterventionsPage() {
  return (
    <React.Suspense fallback={<ZentraPageHeaderSkeleton />}>
      <GuidanceInterventionsPageInner />
    </React.Suspense>
  );
}

function GuidanceInterventionsPageInner() {
  const params = useSearchParams();
  const highlightId = params.get("highlight");
  return <GuidanceInterventionsView key={highlightId ?? "none"} highlightId={highlightId} />;
}
