"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FolderOpen, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ZentraPageHeaderSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { NursePageHeader } from "../components/NursePageHeader";
import { NurseEmptyCard } from "../components/NurseEmptyCard";
import { fetchNurseAlerts } from "@/services/nurse/alerts.service";
import type { NurseAlertsPage } from "@/services/nurse/nurse.types";
import { useTerm } from "@/lib/term/TermContext";
import { NurseDocumentariesList } from "./components/NurseDocumentariesList";
import { NurseRefreshBadge } from "../components/nurse-refresh-badge";
import styles from "./health-records-page.module.css";
import pageStyles from "../pages.module.css";

export default function NurseHealthRecordsPage() {
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;

  const { data, isPending, isError, refetch, isRefetching } =
    useQuery<NurseAlertsPage>({
      queryKey: ["nurse-alerts", "preview", termKey],
      queryFn: ({ signal }) =>
        fetchNurseAlerts({ page: 1, pageSize: 15, signal }),
      placeholderData: keepPreviousData,
      staleTime: 60_000,
      enabled: termReady,
    });

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading health records">
        <ZentraPageHeaderSkeleton />
        <div className={styles.skelPanel}>
          <div className={styles.skelPanelHead}>
            <div>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelPanelDesc} />
            </div>
            <div className={styles.skelPanelActions}>
              <Skeleton className={styles.skelSearch} />
              <Skeleton className={styles.skelDrop} />
            </div>
          </div>
          <div className={styles.skelThead} aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className={styles.skelTheadCell} />
            ))}
          </div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className={styles.skelRow} />
          ))}
          <div className={styles.skelPager}>
            <Skeleton className={styles.skelRange} />
            <div className={styles.skelPagerBtns}>
              <Skeleton className={styles.skelBtn} />
              <Skeleton className={styles.skelPageLabel} aria-hidden="true" />
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
      {isTrueEmpty ? null : (
        <NursePageHeader
          title="Health Records"
          description="Finished clinic sessions and resolved cases, one folder per student."
        />
      )}
      {refreshing ? <NurseRefreshBadge label="Refreshing records…" /> : null}
      {isTrueEmpty ? (
        <NurseEmptyCard
          icon={FolderOpen}
          title="No health records yet"
          hint="Finished clinic sessions and resolved cases will appear here, one folder per student."
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
