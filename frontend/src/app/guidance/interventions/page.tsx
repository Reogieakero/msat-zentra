"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchGuidanceInterventions } from "./components/guidance-interventions-data";
import {
  GuidanceInterventionsTable,
} from "./components/guidance-interventions-table";
import pageStyles from "../pages.module.css";
import styles from "./components/guidance-interventions.module.css";

const PAGE_SIZE = 50;

export default function GuidanceInterventionsPage() {
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const { data, isPending, isError, refetch, isRefetching, isFetching } =
    useQuery({
      queryKey: ["guidance-interventions", { q: debouncedQuery, page, pageSize: PAGE_SIZE }],
      queryFn: ({ signal }) =>
        fetchGuidanceInterventions(
          {
            q: debouncedQuery || undefined,
            level: "All",
            outcome: "all",
            page,
            pageSize: PAGE_SIZE,
          },
          { signal }
        ),
      staleTime: 60_000,
      placeholderData: keepPreviousData,
    });

  return (
    <section className={pageStyles.page}>
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
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <Skeleton key={i} className={styles.skelTh} />
                ))}
              </div>
              {[0, 1, 2, 3, 4].map((row) => (
                <div key={row} className={styles.skelRow}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cell) => (
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
          students={data.students}
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          totalPages={data.totalPages}
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
