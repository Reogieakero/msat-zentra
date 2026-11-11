"use client";

import * as React from "react";
import { useLiveQuery } from "@/lib/api/live";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchMyRecords, type MyAnecdotalRecord } from "@/components/ocform01/folders";
import { useTerm } from "@/lib/term/TermContext";
import { AnecdotalEmptyKanban } from "./components/AnecdotalEmptyKanban";
import { AnecdotalArchiveDialog } from "./components/AnecdotalArchiveDialog";
import { AnecdotalRepoFolders } from "./components/AnecdotalRepoFolders";
import { AnecdotalRepoFoldersSkeleton } from "./components/AnecdotalRepoFoldersSkeleton";
import { AnecdotalToolbarActions } from "./components/AnecdotalSideRail";
import styles from "./components/anecdotal-repo.module.css";

export default function TeacherAnecdotalPage() {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const recordsQuery = useLiveQuery<MyAnecdotalRecord[]>({
    queryKey: ["anecdotal-mine", termKey],
    queryFn: fetchMyRecords,
    retry: false,
    staleTime: 60_000,
  });
  const records = React.useMemo(
    () => (Array.isArray(recordsQuery.data) ? recordsQuery.data : []),
    [recordsQuery.data]
  );
  const [archiveOpen, setArchiveOpen] = React.useState(false);

  if (recordsQuery.isPending) {
    return <AnecdotalRepoFoldersSkeleton />;
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
            <AnecdotalEmptyKanban onOpenArchive={() => setArchiveOpen(true)} />
          </div>
        </div>
        <AnecdotalArchiveDialog open={archiveOpen} onClose={() => setArchiveOpen(false)} />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={`${styles.main} flex min-w-0 flex-col`}>
        <AnecdotalRepoFolders
          records={records}
          toolbarActions={<AnecdotalToolbarActions />}
        />
      </div>
    </section>
  );
}
