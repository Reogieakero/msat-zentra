"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderLegendCard } from "@/app/teacher/anecdotal/components/AnecdotalSideRail";
import { TopReferredCard } from "./components/guidance-anecdotal-siderail";
import { GuidanceAnecdotalFolders } from "./components/guidance-anecdotal-folders";
import type { TypeFilter } from "./components/guidance-anecdotal-filters";
import { fetchGuidanceAnecdotal } from "./components/guidance-anecdotal-data";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./components/guidance-anecdotal.module.css";

const PAGE_SIZE = 50;

/**
 * Guidance anecdotal repository — same layout as the teacher records page:
 * folder panel + right rail (top referred + legend). Every ADM and
 * counseling case referred to the desk, one folder per case; search + type
 * stay in the panel header.
 */
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
      <section className={styles.page} aria-busy="true" aria-label="Loading referred records">
        <div className="grid flex-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className={`${styles.main} flex min-w-0 flex-col`}>
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
          <div className="hidden min-w-0 flex-col gap-4 lg:flex" aria-hidden="true">
            <div className={styles.skelCard}>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelCardDesc} />
              <div className={styles.skelLegend}>
                {[0, 1, 2, 3, 4].map((j) => (
                  <div key={j} className={styles.skelLegendRow}>
                    <Skeleton className={styles.skelLegendLabel} />
                    <Skeleton className={styles.skelLegendCount} />
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.skelCard}>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelCardDesc} />
              <div className={styles.skelLegend}>
                {[0, 1, 2, 3, 4].map((j) => (
                  <div key={j} className={styles.skelLegendRow}>
                    <Skeleton className={styles.skelLegendLabel} />
                    <Skeleton className={styles.skelLegendCount} />
                  </div>
                ))}
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

  const hasActiveFilters = query !== "" || type !== "";
  if (data.total === 0 && !hasActiveFilters) {
    return (
      <section className={`${styles.page} flex min-h-[60vh] flex-1 flex-col justify-center`}>
        <div className={`${assign.card} mx-auto w-full max-w-md`}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex flex-col items-center gap-2 py-8 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
              aria-hidden="true"
            >
              <FolderOpen size={24} className="text-muted-foreground" />
            </span>
            <p className="font-medium">No referred files yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Every ADM and counseling case advisers refer to you will appear here as its own folder.
            </p>
            <Button asChild size="sm" className="mt-2">
              <Link href="/guidance/referrals">View referrals</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className="grid flex-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className={`${styles.main} flex min-w-0 flex-col`}>
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
        <div className="hidden min-w-0 flex-col gap-4 lg:flex">
          <TopReferredCard items={data.summary.topStudents ?? []} />
          <FolderLegendCard />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:hidden">
        <TopReferredCard items={data.summary.topStudents ?? []} />
        <FolderLegendCard />
      </div>
    </section>
  );
}
