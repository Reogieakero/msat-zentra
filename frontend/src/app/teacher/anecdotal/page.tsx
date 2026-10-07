"use client";

import Link from "next/link";
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Cat, FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMyRecords, type MyAnecdotalRecord } from "@/components/ocform01/folders";
import { useTerm } from "@/lib/term/TermContext";
import { AnecdotalRepoFolders } from "./components/AnecdotalRepoFolders";
import { FolderLegendCard, TopAttentionCard } from "./components/AnecdotalSideRail";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./components/anecdotal-repo.module.css";

/**
 * Teacher anecdotal repository: a stored-files message when nothing is
 * filed yet; the sidebar + folder grid once records exist. Filing happens
 * in Chat with Bama (New record button).
 */
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

  // Geometry-matched skeleton: same grid (main + 17rem rail), panel
  // header + search + folder grid, and rail summary cards as the loaded
  // repo — no layout shift when records land.
  if (recordsQuery.isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading filed records">
        <div className="grid flex-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
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
          <div className="hidden min-w-0 flex-col gap-4 lg:flex" aria-hidden>
            <div className={styles.skelCard}>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelCardDesc} />
              <div className={styles.skelLegend}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className={styles.skelLegendRow}>
                    <Skeleton className={styles.skelLegendDot} />
                    <Skeleton className={styles.skelLegendCount} />
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.skelCard}>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelBar} />
            </div>
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
            <p className="font-medium">No files stored yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Files you file through Chat with Bama will appear here once stored.
            </p>
            <Button asChild size="sm" className="mt-2">
              <Link href="/teacher/chat">
                <Cat size={16} aria-hidden="true" />
                Chat with Bama
              </Link>
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
          <AnecdotalRepoFolders records={records} />
        </div>
        <div className="hidden min-w-0 flex-col gap-4 lg:flex">
          <TopAttentionCard records={records} />
          <FolderLegendCard />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:hidden">
        <TopAttentionCard records={records} />
        <FolderLegendCard />
      </div>
    </section>
  );
}
