"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Cat, FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMyRecords } from "@/components/ocform01/folders";
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
  const recordsQuery = useQuery({
    queryKey: ["anecdotal-mine"],
    queryFn: fetchMyRecords,
    retry: false,
    staleTime: 60_000,
  });
  const records = recordsQuery.data ?? [];

  if (recordsQuery.isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading filed records">
        <div className={assign.card} aria-hidden>
          <div className="relative flex flex-col items-center gap-2 py-6 text-center">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
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
