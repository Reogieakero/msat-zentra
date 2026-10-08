"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchGuidanceInterventions } from "@/services/guidance/interventions.service";
import type { GuidanceInterventionsData } from "@/services/guidance/interventions.types";
import {
  GuidanceInterventionsTable,
} from "./components/guidance-interventions-table";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useTerm } from "@/lib/term/TermContext";
import styles from "./components/guidance-interventions.module.css";

const GUIDANCE_INTERVENTIONS_PAGE_SIZE = 15;

export default function GuidanceInterventionsPage() {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const debounced = useDebouncedValue(query.trim(), 300);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const { data, isPending, isError, refetch, isRefetching, isFetching } =
    useQuery<GuidanceInterventionsData>({
      queryKey: ["guidance-interventions", page, debounced, termKey],
      queryFn: ({ signal }) =>
        fetchGuidanceInterventions(
          {
            q: debounced || undefined,
            level: "All",
            outcome: "all",
            page,
            pageSize: GUIDANCE_INTERVENTIONS_PAGE_SIZE,
          },
          { signal }
        ),

      placeholderData: keepPreviousData,
      staleTime: 60_000,
    });

  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const safePage = Math.min(data?.page ?? page, totalPages);

  return (
    <section className={styles.page}>
      {isPending ? (
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
      ) : (
        <GuidanceInterventionsTable
          summary={data.summary}
          students={Array.isArray(data.students) ? data.students : []}
          page={safePage}
          pageSize={data.pageSize}
          total={data.total}
          totalPages={totalPages}
          unfilteredTotal={data.unfilteredTotal}
          onPageChange={setPage}
          query={query}
          onQueryChange={handleQueryChange}
          onRetry={() => refetch()}
          isRetrying={isRefetching}
          isNavigating={isFetching && !isPending}
        />
      )}
    </section>
  );
}
