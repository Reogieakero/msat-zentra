"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { BellRing, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { GuidanceEmptyCard } from "../components/GuidanceEmptyCard";
import {
  GuidanceAlertsTable,
  type RiskFilter,
} from "./components/guidance-alerts-table";
import { GuidanceAlertsSideRail } from "./components/GuidanceAlertsSideRail";
import { fetchGuidanceAlertCases } from "@/services/guidance/alerts.service";
import type {
  AlertCaseType,
  GuidanceAlertCasesData,
} from "@/services/guidance/alerts.types";
import { useTerm } from "@/lib/term/TermContext";
import { guidanceLiveQueryOptions } from "@/lib/api/live";
import { PAGE_SIZE } from "@/components/shared/pagination";
import styles from "./components/guidance-alerts.module.css";
import pageStyles from "../pages.module.css";

/**
 * The board filters locally, so load every page of the merged desk once.
 * Requests happen on mount instead of on every keystroke.
 */
async function fetchAllAlertCases(signal?: AbortSignal): Promise<GuidanceAlertCasesData> {
  const first = await fetchGuidanceAlertCases({ page: 1, pageSize: PAGE_SIZE }, { signal });
  if (first.totalPages <= 1) return first;
  const rest = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, i) =>
      fetchGuidanceAlertCases({ page: i + 2, pageSize: PAGE_SIZE }, { signal })
    )
  );
  return {
    ...first,
    cases: [first.cases, ...rest.map((r) => r.cases)].flat(),
    page: 1,
  };
}

export default function GuidanceAlertsPage() {
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [riskFilter, setRiskFilter] = React.useState<RiskFilter>("");
  const [typeFilter, setTypeFilter] = React.useState<AlertCaseType>("");
  const [queryInput, setQueryInput] = React.useState("");

  // One server request for the whole merged desk (referrals + live
  // interventions), then search / tabs / paging are all client-side. The board
  // used to fan out to twenty requests and made the backend recompute the live
  // cohort ten times per visit.
  const casesQuery = useQuery<GuidanceAlertCasesData>({
    ...guidanceLiveQueryOptions,
    queryKey: ["guidance-alerts", "cases", termKey],
    queryFn: ({ signal }) => fetchAllAlertCases(signal),
    placeholderData: keepPreviousData,
    enabled: termReady,
  });

  const isFetching = casesQuery.isFetching;
  const data = casesQuery.data;
  const summary = data?.summary;
  const isTrueEmpty = (summary?.total ?? 0) === 0;

  if (casesQuery.isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading referred cases">
        <div className={styles.body}>
          <div className={styles.mainCol}>
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
          </div>
          <div className={styles.skelRail} aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className={styles.skelRailIcon} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (casesQuery.isError || !data || !summary) {
    return (
      <section className={styles.page}>
        <div className={styles.pageError} role="alert">
          <p className={styles.pageErrorTitle}>We couldn&apos;t load the referred cases</p>
          <p className={styles.pageErrorHint}>
            Please check your internet connection and try again.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={isFetching}
            onClick={() => {
              void casesQuery.refetch();
            }}
          >
            {isFetching ? (
              <Loader2 className={styles.spin} aria-hidden="true" />
            ) : null}
            {isFetching ? "Retrying…" : "Try again"}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      className={isTrueEmpty ? `${styles.page} ${pageStyles.pageFit}` : styles.page}
      aria-busy={isFetching || undefined}
      aria-label="Alerts"
    >
      {isTrueEmpty ? (
        <GuidanceEmptyCard
          icon={BellRing}
          title="No referred cases"
          hint="New ADM, counseling, and intervention cases will appear here."
          label="Referred cases"
          centered
          layout="fit"
        />
      ) : (
        <div className={styles.body}>
          <div className={styles.mainCol}>
            <GuidanceAlertsTable
              rows={data.cases}
              riskByStudent={data.riskByStudent}
              summary={summary}
              query={queryInput}
              type={typeFilter}
              risk={riskFilter}
              onQueryChange={setQueryInput}
              onTypeChange={setTypeFilter}
              onRiskChange={setRiskFilter}
            />
          </div>
          <GuidanceAlertsSideRail
            summary={summary}
            activeRisk={riskFilter}
            onRiskFilterChange={setRiskFilter}
          />
        </div>
      )}
    </section>
  );
}
