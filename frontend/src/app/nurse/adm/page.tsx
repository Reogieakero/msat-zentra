"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTerm } from "@/lib/term/TermContext";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchNurseAlerts } from "@/services/nurse/alerts.service";
import { fetchNurseRiskLevels } from "@/services/nurse/risk.service";
import type {
  NurseAlertsPage,
  NurseRiskLevel,
} from "@/services/nurse/nurse.types";
import {
  buildNurseAdmInsights,
  buildNurseAdmReferrals,
} from "./components/nurse-adm-data";
import { NurseAdmInsights } from "./components/NurseAdmInsights";
import { NurseAdmReports } from "./components/NurseAdmReports";
import { NurseRefreshBadge } from "../components/nurse-refresh-badge";
import styles from "./components/nurse-adm.module.css";

/**
 * Referrals Report — insights and reports over every case referred to the
 * school nurse (clinic + ADM). Case work itself lives on the ADM Cases
 * and Clinic Matters timelines, linked from the recommendations below.
 */
export default function NurseAdmPage() {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  // Aggregate insights view: bounded desk fetch (previews slice downstream).
  const { data: alertsData, isPending, isError, refetch, isFetching } =
    useQuery<NurseAlertsPage>({
      queryKey: ["nurse-alerts", "preview", termKey],
      queryFn: ({ signal }) =>
        fetchNurseAlerts({ page: 1, pageSize: 100, signal }),
      placeholderData: keepPreviousData,
      staleTime: 60_000,
    });

  // All-status case list (pending through dismissed) — insights, reports,
  // and queue always reflect the current referrals whatever their status.
  const data = React.useMemo(
    () => (alertsData ? buildNurseAdmReferrals(alertsData.cases) : null),
    [alertsData]
  );

  // Live rule-based risk level per student behind these cases (account
  // id or roster id — the endpoint serves both). Desk-wide so the
  // high-risk recommendation sees clinic cases too.
  const studentIds = React.useMemo(
    () =>
      [
        ...new Set(
          (data?.desk ?? [])
            .map((a) => a.studentId)
            .filter((id): id is string => id !== null)
        ),
      ].sort(),
    [data]
  );
  const {
    data: riskByStudent,
    isFetching: riskFetching,
    isError: riskError,
    refetch: refetchRisk,
  } = useQuery<Record<string, NurseRiskLevel>>({
    queryKey: ["nurse-risk-levels", studentIds, termKey],
    queryFn: () => fetchNurseRiskLevels(studentIds),
    staleTime: 300_000,
    enabled: studentIds.length > 0,
  });

  // Referral insights derive from the same desk list the reports read
  // (clinic + ADM), so every number repaints live with the desk — no
  // extra fetch.
  const insights = React.useMemo(
    () =>
      data ? buildNurseAdmInsights(data.desk, riskByStudent ?? {}) : null,
    [data, riskByStudent],
  );

  if (isPending) {
    // High-fidelity skeleton mirroring the findings strip + NurseAdmReports
    // (donut + legend, 12-week line + interpretations) so nothing shifts on
    // load.
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading referrals report">
        <div className={styles.skelFindings} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className={styles.skelFinding} />
          ))}
        </div>
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
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <div className={styles.pageError} role="alert">
          <p className={styles.pageErrorTitle}>We couldn&apos;t load the referrals report</p>
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
      {refreshing ? <NurseRefreshBadge label="Refreshing referrals report…" /> : null}
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
      {insights ? <NurseAdmInsights data={insights} /> : null}
      <NurseAdmReports data={data} />
    </section>
  );
}
