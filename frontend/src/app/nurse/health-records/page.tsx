"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchNurseAlerts } from "../alerts/components/nurse-alerts-data";
import { NurseDocumentariesList } from "./components/NurseDocumentariesList";
import { NurseRefreshBadge } from "../components/nurse-refresh-badge";
import styles from "./health-records-page.module.css";

/**
 * Health Records — the school nurse transaction archive: every finished
 * transaction (completed clinic sessions with notes, outcomes, and
 * attached files, plus resolved case closures) for the students on the
 * nurse's desk. Read-only; handling stays on the case pages.
 */
export default function NurseHealthRecordsPage() {
  const { data, isPending, isError, refetch, isRefetching } = useQuery({
    queryKey: ["nurse-alerts"],
    queryFn: fetchNurseAlerts,
    staleTime: 60_000,
  });

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true">
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

  return (
    <section className={styles.page} aria-busy={refreshing}>
      {refreshing ? <NurseRefreshBadge label="Refreshing records…" /> : null}
      <NurseDocumentariesList alerts={data.alerts} />
    </section>
  );
}
