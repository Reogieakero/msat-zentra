"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchGuidanceReferrals } from "./components/guidance-referrals-data";
import { GuidanceReferralsTable } from "./components/guidance-referrals-table";
import type { StatusFilter } from "./components/guidance-referrals-filters";
import styles from "./components/guidance-referrals.module.css";

const PAGE_SIZE = 12;

export default function GuidanceReferralsPage() {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("");
  const [page, setPage] = React.useState(1);
  const [debouncedQuery, setDebouncedQuery] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleStatusChange = (value: StatusFilter) => {
    setStatus(value);
    setPage(1);
  };

  const { data, isPending, isError, refetch, isRefetching, isFetching } = useQuery({
    queryKey: [
      "guidance-referrals",
      { q: debouncedQuery, status, page, pageSize: PAGE_SIZE },
    ],
    queryFn: () =>
      fetchGuidanceReferrals({
        q: debouncedQuery || undefined,
        status: status || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.skelToolbar}>
          <Skeleton className={styles.skelSearch} />
          <Skeleton className={styles.skelDrop} />
        </div>
        <div className={styles.skelTimeline}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skelEntry}>
              <Skeleton className={styles.skelRail} />
              <Skeleton className={styles.skelBody} />
              <Skeleton className={styles.skelAside} />
            </div>
          ))}
        </div>
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
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        totalPages={data.totalPages}
        onPageChange={setPage}
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={handleStatusChange}
        onRetry={() => refetch()}
        isRetrying={isRefetching}
        isNavigating={isFetching && !isPending}
      />
    </section>
  );
}
