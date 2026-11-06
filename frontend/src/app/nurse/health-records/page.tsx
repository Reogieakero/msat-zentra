"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FolderOpen, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ZentraPaginationSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { NurseEmptyCard } from "../components/NurseEmptyCard";
import { fetchNurseAlerts } from "@/services/nurse/alerts.service";
import type { NurseAlertsPage } from "@/services/nurse/nurse.types";
import { useTerm } from "@/lib/term/TermContext";
import { NurseDocumentariesList } from "./components/NurseDocumentariesList";
import { HealthRecordCardSkeleton } from "./components/HealthRecordCardSkeleton";
import listStyles from "./components/NurseDocumentariesList.module.css";
import styles from "./health-records-page.module.css";
import pageStyles from "../pages.module.css";
import { PAGE_SIZE } from "@/components/shared/pagination";

export default function NurseHealthRecordsPage() {
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;

  const { data, isPending, isError, refetch, isRefetching } =
    useQuery<NurseAlertsPage>({
      queryKey: ["nurse-alerts", "preview", termKey],
      queryFn: ({ signal }) =>
        fetchNurseAlerts({ page: 1, pageSize: PAGE_SIZE, signal }),
      placeholderData: keepPreviousData,
      staleTime: 60_000,
      enabled: termReady,
    });

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading health records">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Skeleton className="h-8 w-56 max-w-full shrink-0 rounded-[16px]" />
          </div>
          <div className={listStyles.grid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <HealthRecordCardSkeleton key={i} />
            ))}
          </div>
          <ZentraPaginationSkeleton />
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <div className={styles.pageError} role="alert">
          <p className={styles.pageErrorTitle}>We couldn&apos;t load the health records</p>
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
            Try again
          </Button>
        </div>
      </section>
    );
  }

  const refreshing = isRefetching && !isPending;
  const isTrueEmpty = (data.unfilteredTotal ?? data.total) === 0;

  return (
    <section
      className={isTrueEmpty ? `${styles.page} ${pageStyles.pageFit}` : styles.page}
      aria-busy={refreshing}
      aria-label="Health records"
    >
      {isTrueEmpty ? (
        <NurseEmptyCard
          icon={FolderOpen}
          title="No health records yet"
          hint="Finished clinic sessions and resolved cases will appear here, one card per record."
          label="Health records"
          centered
          layout="fit"
        />
      ) : (
      <NurseDocumentariesList
        alerts={Array.isArray(data.alerts) ? data.alerts : []}
      />
      )}
    </section>
  );
}
