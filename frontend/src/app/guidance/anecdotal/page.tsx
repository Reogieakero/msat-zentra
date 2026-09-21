"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GuidanceAnecdotalCharts } from "./components/guidance-anecdotal-charts";
import { GuidanceAnecdotalGradeChart } from "./components/guidance-anecdotal-grade";
import { GuidanceAnecdotalFolders } from "./components/guidance-anecdotal-folders";
import type { TypeFilter } from "./components/guidance-anecdotal-filters";
import { fetchGuidanceAnecdotal } from "./components/guidance-anecdotal-data";
import styles from "./components/guidance-anecdotal.module.css";

const PAGE_SIZE = 50;

export default function GuidanceAnecdotalPage() {
  const [queryInput, setQueryInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState<TypeFilter>("");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(queryInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const handleQueryInputChange = (value: string) => {
    setQueryInput(value);
    setPage(1);
  };

  const { data, isPending, isError, isFetching, refetch, isRefetching } = useQuery({
    queryKey: ["guidance-anecdotal", query, type, page],
    queryFn: ({ signal }) =>
      fetchGuidanceAnecdotal({ q: query, type, page, pageSize: PAGE_SIZE }, { signal }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.layout}>
          <div className={styles.side}>
            <div className={styles.skelCard}>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelCardDesc} />
              <Skeleton className={styles.skelChart} />
              <div className={styles.skelLegend}>
                {[0, 1, 2, 3, 4].map((j) => (
                  <div key={j} className={styles.skelLegendRow}>
                    <Skeleton className={styles.skelLegendLabel} />
                    <Skeleton className={styles.skelLegendCount} />
                  </div>
                ))}
              </div>
              <Skeleton className={styles.skelInterpretation} />
            </div>
            <div className={styles.skelCard}>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelCardDesc} />
              <div className={styles.skelGradeBars}>
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className={styles.skelGradeRow}>
                    <Skeleton className={styles.skelGradeLabel} />
                    <Skeleton className={styles.skelGradeBar} />
                    <Skeleton className={styles.skelGradeCount} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.main}>
            <div className={styles.skelPanel}>
              <div className={styles.skelPanelHead}>
                <div className={styles.skelPanelHeadText}>
                  <div className={styles.skelPanelTitleRow}>
                    <Skeleton className={styles.skelPanelTitle} />
                    <Skeleton className={styles.skelHelpBtn} />
                  </div>
                  <Skeleton className={styles.skelPanelDesc} />
                </div>
                <div className={styles.skelPanelActions}>
                  <Skeleton className={styles.skelSearch} />
                  <Skeleton className={styles.skelDrop} />
                </div>
              </div>
              <div className={styles.skelFolderGrid}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className={styles.skelFolderCard}>
                    <Skeleton className={styles.skelFolderBadge} />
                    <Skeleton className={styles.skelFolder} />
                    <Skeleton className={styles.skelFolderLabel} />
                    <Skeleton className={styles.skelFolderSub} />
                  </div>
                ))}
              </div>
              <div className={styles.skelPager}>
                <Skeleton className={styles.skelRange} />
                <div className={styles.skelPagerBtns}>
                  <Skeleton className={styles.skelBtn} />
                  <Skeleton className={styles.skelPageLabel} />
                  <Skeleton className={styles.skelBtn} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>Could not load the anecdotal records.</p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Button
            size="sm"
            variant="outline"
            disabled={isRefetching}
            onClick={() => refetch()}
          >
            {isRefetching ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}
            {isRefetching ? "Loading…" : "Try again"}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.layout}>
        <aside className={styles.side}>
          <GuidanceAnecdotalCharts summary={data.summary} />
          <GuidanceAnecdotalGradeChart summary={data.summary} />
        </aside>

        <div className={styles.main}>
          <GuidanceAnecdotalFolders
            records={data.records}
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            totalPages={data.totalPages}
            isNavigating={isFetching && !isPending}
            onPageChange={setPage}
            query={queryInput}
            onQueryChange={handleQueryInputChange}
            type={type}
            onTypeChange={(value) => {
              setType(value);
              setPage(1);
            }}
          />
        </div>
      </div>
    </section>
  );
}
