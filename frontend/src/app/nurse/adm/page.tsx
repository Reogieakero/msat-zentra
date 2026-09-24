"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchNurseAlerts,
  fetchNurseRiskLevels,
  type NurseAlertsData,
} from "../alerts/components/nurse-alerts-data";
import { buildNurseAdmReferrals } from "./components/nurse-adm-data";
import { NurseAdmReports } from "./components/NurseAdmReports";
import { NurseAdmQueueTable } from "./components/NurseAdmQueueTable";
import { NurseRefreshBadge } from "../components/nurse-refresh-badge";
import styles from "./components/nurse-adm.module.css";

/**
 * ADM Referrals — every ADM case referred to the school nurse, same
 * reports + review-queue shape as the guidance ADM Referrals page but
 * wired to nurse-scope cases and nurse actions (referral form, forward
 * to the coordinator, clinic sessions).
 */
export default function NurseAdmPage() {
  const queryClient = useQueryClient();
  const { data: alertsData, isPending, isError, refetch, isFetching } =
    useQuery<NurseAlertsData>({
      queryKey: ["nurse-alerts"],
      queryFn: fetchNurseAlerts,
      staleTime: 60_000,
    });

  const data = React.useMemo(
    () => (alertsData ? buildNurseAdmReferrals(alertsData.alerts) : null),
    [alertsData]
  );

  // Live rule-based risk level per student behind these cases (account
  // id or roster id — the endpoint serves both).
  const studentIds = React.useMemo(
    () => [
      ...new Set(
        (data?.queue ?? [])
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

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["nurse-alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["nurse-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["nurse-risk"] });
    void queryClient.invalidateQueries({ queryKey: ["nurse-risk-levels"] });
  }

  if (isPending) {
    // High-fidelity skeleton mirroring NurseAdmReports (donut + legend,
    // 12-week line + interpretations) + queue panel (head + search +
    // 8-col thead + rows + pager) so nothing shifts on load.
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading ADM referrals">
        <div className={styles.skelGrid} aria-hidden="true">
          <Card className={styles.card}>
            <CardContent className={styles.skelCardBody}>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelPanelDesc} />
              <div className={styles.skelSplit}>
                <Skeleton className={styles.skelDonut} />
                <div className={styles.skelLegend}>
                  {[0, 1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className={styles.skelLegendRow} />
                  ))}
                </div>
              </div>
              <Skeleton className={styles.skelInterp} />
            </CardContent>
          </Card>
          <Card className={styles.card}>
            <CardContent className={styles.skelCardBody}>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelPanelDesc} />
              <Skeleton className={styles.skelLine} />
              <Skeleton className={styles.skelInterp} />
            </CardContent>
          </Card>
        </div>

        <Card className={styles.card} aria-hidden="true">
          <CardContent className={styles.skelPanel}>
            <div className={styles.skelPanelHead}>
              <div>
                <Skeleton className={styles.skelCardTitle} />
                <Skeleton className={styles.skelPanelDesc} />
              </div>
              <div className={styles.skelPanelActions}>
                <Skeleton className={styles.skelSearch} />
              </div>
            </div>
            <div className={styles.skelThead}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <Skeleton key={i} className={styles.skelTheadCell} />
              ))}
            </div>
            <div className={styles.skelCards}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className={styles.skelCardRow} />
              ))}
            </div>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className={styles.skelRow} />
            ))}
            <div className={styles.skelPager}>
              <Skeleton className={styles.skelRange} />
              <div className={styles.skelPagerBtns}>
                <Skeleton className={styles.skelBtn} />
                <Skeleton className={styles.skelPageLabel} />
                <Skeleton className={styles.skelBtn} />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <div className={styles.pageError} role="alert">
          <p className={styles.pageErrorTitle}>We couldn&apos;t load the ADM referrals</p>
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

  const refreshing = isFetching && !isPending;

  return (
    <section className={styles.page} aria-busy={refreshing}>
      {refreshing ? <NurseRefreshBadge label="Refreshing ADM referrals…" /> : null}
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
      <NurseAdmReports data={data} />

      <NurseAdmQueueTable
        queue={data.queue}
        riskByStudent={riskByStudent ?? {}}
        riskLoading={riskLoading}
        onChanged={refresh}
      />
    </section>
  );
}
