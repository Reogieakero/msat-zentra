"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { GuidanceAnecdotalHeader } from "./components/guidance-anecdotal-header";
import { GuidanceAnecdotalCharts } from "./components/guidance-anecdotal-charts";
import { GuidanceAnecdotalFolders } from "./components/guidance-anecdotal-folders";
import type { CategoryFilter } from "./components/guidance-anecdotal-filters";
import { fetchGuidanceAnecdotal } from "./components/guidance-anecdotal-data";
import styles from "./components/guidance-anecdotal.module.css";

const PAGE_SIZE = 50;

export default function GuidanceAnecdotalPage() {
  const [queryInput, setQueryInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<CategoryFilter>("");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(queryInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const { data, isPending, isError, isFetching } = useQuery({
    queryKey: ["guidance-anecdotal", query, category, page],
    queryFn: () =>
      fetchGuidanceAnecdotal({ q: query, category, page, pageSize: PAGE_SIZE }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.skelHeadText}>
          <Skeleton className={styles.skelEyebrow} />
          <Skeleton className={styles.skelTitle} />
          <Skeleton className={styles.skelLede} />
        </div>

        <div className={styles.skelCard}>
          <Skeleton className={styles.skelCardTitle} />
          <Skeleton className={styles.skelCardDesc} />
          <Skeleton className={styles.skelChart} />
          <Skeleton className={styles.skelLineShort} />
        </div>

        <hr className={styles.divider} />

        <div className={styles.skelPanel}>
          <div className={styles.skelPanelHead}>
            <div className={styles.skelPanelHeadText}>
              <Skeleton className={styles.skelPanelTitle} />
              <Skeleton className={styles.skelPanelDesc} />
            </div>
            <div className={styles.skelPanelActions}>
              <Skeleton className={styles.skelSearch} />
              <Skeleton className={styles.skelDrop} />
            </div>
          </div>
          <div className={styles.skelFolderGrid}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className={styles.skelFolder} />
            ))}
          </div>
          <div className={styles.skelPager}>
            <Skeleton className={styles.skelRange} />
            <div className={styles.skelPagerBtns}>
              <Skeleton className={styles.skelBtn} />
              <Skeleton className={styles.skelBtn} />
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
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <GuidanceAnecdotalHeader />

      <GuidanceAnecdotalCharts summary={data.summary} />

      <hr className={styles.divider} />

      <GuidanceAnecdotalFolders
        records={data.records}
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        totalPages={data.totalPages}
        isNavigating={isFetching && !isPending}
        onPageChange={setPage}
        query={queryInput}
        onQueryChange={setQueryInput}
        category={category}
        onCategoryChange={(value) => {
          setCategory(value);
          setPage(1);
        }}
      />
    </section>
  );
}
