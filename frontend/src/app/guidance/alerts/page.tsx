"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { GuidanceAlertsTable } from "./components/guidance-alerts-table";
import { GuidanceAlertsSideRail } from "./components/GuidanceAlertsSideRail";
import { fetchAllGuidanceReferrals } from "@/services/guidance/referrals.service";
import { fetchGuidanceRiskLevels } from "@/services/guidance/risk.service";
import type {
  GuidanceReferralItem,
  GuidanceRiskLevel,
} from "@/services/guidance/guidance.types";
import { fetchAllGuidanceInterventions } from "@/services/guidance/interventions.service";
import type { AtRiskStudentItem } from "@/services/guidance/interventions.types";
import { useTerm } from "@/lib/term/TermContext";
import styles from "./components/guidance-alerts.module.css";

export default function GuidanceAlertsPage() {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;

  const referralsQuery = useQuery<GuidanceReferralItem[]>({

    queryKey: ["guidance-alerts", "referrals", termKey],
    queryFn: () => fetchAllGuidanceReferrals(),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const interventionsQuery = useQuery<AtRiskStudentItem[]>({

    queryKey: ["guidance-alerts", "interventions", termKey],
    queryFn: fetchAllGuidanceInterventions,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const isPending = referralsQuery.isPending || interventionsQuery.isPending;
  const isError = referralsQuery.isError || interventionsQuery.isError;
  const isFetching = referralsQuery.isFetching || interventionsQuery.isFetching;

  const referrals = React.useMemo(
    () => (Array.isArray(referralsQuery.data) ? referralsQuery.data : []),
    [referralsQuery.data]
  );
  const interventions = React.useMemo(
    () => (Array.isArray(interventionsQuery.data) ? interventionsQuery.data : []),
    [interventionsQuery.data]
  );

  const studentIds = React.useMemo(
    () =>
      [
        ...new Set(
          referrals.map((r) => r.studentId).filter((id): id is string => id !== null)
        ),
      ].sort(),
    [referrals]
  );
  const { data: riskByStudent } = useQuery<Record<string, GuidanceRiskLevel>>({
    queryKey: ["guidance-risk-levels", studentIds, termKey],
    queryFn: () => fetchGuidanceRiskLevels(studentIds),
    placeholderData: keepPreviousData,
    staleTime: 300_000,
    enabled: studentIds.length > 0,
  });

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.repoGrid}>
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
          <div className={`${styles.sideRail} ${styles.railDesktop}`} aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className={styles.skelRailCard}>
                <Skeleton className={styles.skelRailTitle} />
                <Skeleton className={styles.skelRailDesc} />
                <Skeleton className={styles.skelRailLine} />
              </div>
            ))}
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
      <div className={styles.repoGrid}>
        <div className="flex min-w-0 flex-col">
          <GuidanceAlertsTable
            referrals={referrals}
            interventions={interventions}
            riskByStudent={riskByStudent ?? {}}
          />
        </div>
        <div className={`${styles.sideRail} ${styles.railDesktop}`}>
          <GuidanceAlertsSideRail
            referrals={referrals}
            interventions={interventions}
            riskByStudent={riskByStudent ?? {}}
          />
        </div>
      </div>
      <div className={`${styles.sideRail} ${styles.railMobile}`}>
        <GuidanceAlertsSideRail
          referrals={referrals}
          interventions={interventions}
          riskByStudent={riskByStudent ?? {}}
        />
      </div>
    </section>
  );
}
