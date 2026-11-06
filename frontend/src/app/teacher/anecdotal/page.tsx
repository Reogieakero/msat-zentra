"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMyRecords, type MyAnecdotalRecord } from "@/components/ocform01/folders";
import { useTerm } from "@/lib/term/TermContext";
import { AnecdotalEmptyKanban } from "./components/AnecdotalEmptyKanban";
import { AnecdotalRepoFolders } from "./components/AnecdotalRepoFolders";
import { AnecdotalSidebar, ChatWithBamaCard, FolderLegendCard } from "./components/AnecdotalSideRail";
import styles from "./components/anecdotal-repo.module.css";

export default function TeacherAnecdotalPage() {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const recordsQuery = useQuery<MyAnecdotalRecord[]>({
    queryKey: ["anecdotal-mine", termKey],
    queryFn: fetchMyRecords,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 60_000,
  });
  const records = React.useMemo(
    () => (Array.isArray(recordsQuery.data) ? recordsQuery.data : []),
    [recordsQuery.data]
  );

  if (recordsQuery.isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading filed records">
        <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_2.75rem]">
          <div className={`${styles.main} flex min-w-0 flex-col`}>
            <div className={styles.skelPanel} aria-hidden>
              <Skeleton className={styles.skelPanelTitle} />
              <Skeleton className={styles.skelPanelDesc} />
              <div className={styles.skelActions}>
                <Skeleton className={styles.skelSearch} />
                <Skeleton className={styles.skelBtn} />
              </div>
              <div className={styles.skelFolderGrid}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex min-w-0 flex-col gap-2">
                    <Skeleton className={styles.skelFolder} />
                    <Skeleton className={styles.skelFolderLabel} />
                    <Skeleton className={styles.skelFolderSub} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="hidden min-w-0 flex-col items-end gap-2 lg:flex" aria-hidden>
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-4 lg:hidden" aria-hidden>
          <div className={styles.skelCard}>
            <Skeleton className={styles.skelCardTitle} />
            <Skeleton className={styles.skelCardDesc} />
          </div>
        </div>
      </section>
    );
  }

  if (recordsQuery.isError) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>
          Your filed records could not be loaded. Check your connection and try again.
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Button
            size="sm"
            variant="outline"
            disabled={recordsQuery.isRefetching}
            onClick={() => recordsQuery.refetch()}
          >
            {recordsQuery.isRefetching ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}
            {recordsQuery.isRefetching ? "Retrying…" : "Try again"}
          </Button>
        </div>
      </section>
    );
  }

  if (records.length === 0) {
    return (
      <section className={styles.page} aria-label="Anecdotal records">
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="w-full">
            <AnecdotalEmptyKanban />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_2.75rem]">
        <div className={`${styles.main} flex min-w-0 flex-col`}>
          <AnecdotalRepoFolders records={records} />
        </div>
        <AnecdotalSidebar />
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:hidden">
        <ChatWithBamaCard />
        <FolderLegendCard />
      </div>
    </section>
  );
}
