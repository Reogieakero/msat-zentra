"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { GuidanceAlertsHeader } from "./components/guidance-alerts-header";
import { GuidanceAlertsSummary } from "./components/guidance-alerts-summary";
import type {
  FactorFilter,
  LevelFilter,
} from "./components/guidance-alerts-filters";
import { GuidanceAlertsGrid } from "./components/guidance-alerts-grid";
import { fetchGuidanceAlerts } from "./components/guidance-alerts-data";
import styles from "./components/guidance-alerts.module.css";

const PAGE_SIZE = 50;

export default function GuidanceAlertsPage() {
  const [queryInput, setQueryInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [level, setLevel] = React.useState<LevelFilter>("");
  const [factor, setFactor] = React.useState<FactorFilter>("");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(queryInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const { data, isPending, isError, isFetching } = useQuery({
    queryKey: ["guidance-alerts", query, level, factor, page],
    queryFn: () =>
      fetchGuidanceAlerts({ q: query, level, factor, page, pageSize: PAGE_SIZE }),
    // Keep the previous page on screen while the next one loads, and reuse
    // cached pages for 60s so back-navigation feels instant.
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.skelHead}>
          <div className={styles.skelHeadText}>
            <Skeleton className={styles.skelEyebrow} />
            <Skeleton className={styles.skelTitle} />
            <Skeleton className={styles.skelLede} />
            <Skeleton className={styles.skelLede} />
          </div>
          <Skeleton className={styles.skelBadge} />
        </div>

        <div className={styles.skelKpiGrid}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.skelKpiCard}>
              <Skeleton className={styles.skelKpiLabel} />
              <Skeleton className={styles.skelKpiValue} />
              <Skeleton className={styles.skelKpiHint} />
            </div>
          ))}
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
              <Skeleton className={styles.skelDrop} />
            </div>
          </div>
          <div className={styles.skelAlertGrid}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={styles.skelAlertCard}>
                <div className={styles.skelCardHead}>
                  <div className={styles.skelCardHeadText}>
                    <Skeleton className={styles.skelName} />
                    <Skeleton className={styles.skelNameSub} />
                  </div>
                  <Skeleton className={styles.skelLevel} />
                </div>
                <div className={styles.skelChips}>
                  <Skeleton className={styles.skelChip} />
                  <Skeleton className={styles.skelChip} />
                </div>
                <ul className={styles.skelBullets}>
                  {[0, 1, 2].map((j) => (
                    <li key={j} className={styles.skelBullet}>
                      <span className={styles.skelBulletDot} aria-hidden />
                      <Skeleton className={styles.skelBulletLine} />
                    </li>
                  ))}
                </ul>
                <div className={styles.skelCardActions}>
                  <Skeleton className={styles.skelBtn} />
                  <Skeleton className={styles.skelBtn} />
                </div>
              </div>
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
        <p className={styles.error}>Could not load the alerts queue.</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <GuidanceAlertsHeader />

      <GuidanceAlertsSummary summary={data.summary} />

      <hr className={styles.divider} />

      <GuidanceAlertsGrid
        alerts={data.alerts}
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        totalPages={data.totalPages}
        isNavigating={isFetching && !isPending}
        onPageChange={setPage}
        query={queryInput}
        onQueryChange={setQueryInput}
        level={level}
        onLevelChange={(value) => {
          setLevel(value);
          setPage(1);
        }}
        factor={factor}
        onFactorChange={(value) => {
          setFactor(value);
          setPage(1);
        }}
      />
    </section>
  );
}
