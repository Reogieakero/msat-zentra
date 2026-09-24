"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { NurseReferralsTable } from "./components/NurseReferralsTable";
import { NurseRefreshBadge } from "../components/nurse-refresh-badge";
import { fetchNurseAlerts, fetchNurseRiskLevels } from "./components/nurse-alerts-data";
import styles from "./components/nurse-alerts.module.css";

export default function NurseAlertsPage() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ["nurse-alerts"],
    queryFn: fetchNurseAlerts,
    staleTime: 60_000,
  });

  // Live rule-based risk level per student behind these cases (account id
  // or roster id — the endpoint serves both).
  const studentIds = React.useMemo(
    () => [
      ...new Set(
        (data?.alerts ?? [])
          .map((a) => a.studentId)
          .filter((id): id is string => id !== null)
      ),
    ],
    [data]
  );
  const {
    data: riskByStudent,
    isPending: riskPending,
    isFetching: riskFetching,
    isError: riskError,
    refetch: refetchRisk,
  } = useQuery({
    queryKey: ["nurse-risk-levels", studentIds],
    queryFn: () => fetchNurseRiskLevels(studentIds),
    staleTime: 300_000,
    enabled: studentIds.length > 0,
  });
  const riskLoading = studentIds.length > 0 && (riskPending || riskFetching);

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

  if (isError || !data) {
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
            onClick={() => refetch()}
          >
            {isFetching ? (
              <Loader2 className={styles.spin} aria-hidden="true" />
            ) : null}
            Try again
          </Button>
        </div>
      </section>
    );
  }

  // Background refetch: keep data visible, show a subtle indicator.
  // Risk levels load independently — the table renders with "—" shimmer
  // state instead of blocking, and surfaces retry on failure.
  const refreshing = isFetching && !isPending;

  return (
    <section className={styles.page} aria-busy={refreshing}>
      {refreshing ? <NurseRefreshBadge label="Refreshing cases…" /> : null}
      {riskError && studentIds.length > 0 ? (
        <p role="alert" style={{ margin: 0, fontSize: "0.8125rem", color: "var(--destructive)" }}>
          Risk levels couldn&apos;t load.{" "}
          <button
            type="button"
            onClick={() => refetchRisk()}
            disabled={riskFetching}
            style={{ textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit" }}
          >
            {riskFetching ? "Retrying…" : "Retry"}
          </button>
        </p>
      ) : null}
      <NurseReferralsTable
        alerts={data.alerts}
        riskByStudent={riskByStudent ?? {}}
        riskLoading={riskLoading}
        onChanged={() => {
          void queryClient.invalidateQueries({ queryKey: ["nurse-alerts"] });
          void queryClient.invalidateQueries({ queryKey: ["nurse-overview"] });
          void queryClient.invalidateQueries({ queryKey: ["nurse-risk"] });
          void queryClient.invalidateQueries({ queryKey: ["nurse-risk-levels"] });
        }}
      />
    </section>
  );
}
