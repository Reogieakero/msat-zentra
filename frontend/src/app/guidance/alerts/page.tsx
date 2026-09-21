"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { GuidanceAlertsTable } from "./components/guidance-alerts-table";
import {
  fetchAllGuidanceReferrals,
  fetchGuidanceRiskLevels,
} from "../referrals/components/guidance-referrals-data";
import { fetchAllGuidanceInterventions } from "../interventions/components/guidance-interventions-data";
import styles from "./components/guidance-alerts.module.css";

export default function GuidanceAlertsPage() {
  const referralsQuery = useQuery({
    queryKey: ["guidance-alerts-referrals"],
    queryFn: () => fetchAllGuidanceReferrals(),
    staleTime: 60_000,
  });
  const interventionsQuery = useQuery({
    queryKey: ["guidance-alerts-interventions"],
    queryFn: fetchAllGuidanceInterventions,
    staleTime: 60_000,
  });

  const isPending = referralsQuery.isPending || interventionsQuery.isPending;
  const isError = referralsQuery.isError || interventionsQuery.isError;
  const isFetching = referralsQuery.isFetching || interventionsQuery.isFetching;
  const referrals = referralsQuery.data ?? [];
  const interventions = interventionsQuery.data ?? [];

  // Live rule-based risk level per referred student (account id or roster
  // id — the endpoint serves both). Intervention rows carry their level
  // directly, so only referrals need the lookup.
  const studentIds = React.useMemo(
    () => [
      ...new Set(
        referrals.map((r) => r.studentId).filter((id): id is string => id !== null)
      ),
    ],
    [referrals]
  );
  const { data: riskByStudent } = useQuery({
    queryKey: ["guidance-risk-levels", studentIds],
    queryFn: () => fetchGuidanceRiskLevels(studentIds),
    staleTime: 300_000,
    enabled: studentIds.length > 0,
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
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
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

  if (isError) {
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
              void referralsQuery.refetch();
              void interventionsQuery.refetch();
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
    <section className={styles.page}>
      <GuidanceAlertsTable
        referrals={referrals}
        interventions={interventions}
        riskByStudent={riskByStudent ?? {}}
      />
    </section>
  );
}
