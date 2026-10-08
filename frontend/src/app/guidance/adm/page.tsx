"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTerm } from "@/lib/term/TermContext";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshBadge } from "@/components/ui/refresh-badge";
import { fetchAllGuidanceReferrals } from "@/services/guidance/referrals.service";
import { fetchGuidanceRiskLevels } from "@/services/guidance/risk.service";
import type {
  GuidanceReferralItem,
  GuidanceRiskLevel,
} from "@/services/guidance/guidance.types";
import {
  buildGuidanceAdmInsights,
  buildGuidanceAdmReferrals,
} from "@/services/guidance/adm.reports";
import { GuidanceAdmInsights } from "./components/GuidanceAdmInsights";
import { GuidanceAdmReports } from "./components/guidance-adm-reports";
import pageStyles from "../pages.module.css";
import styles from "./components/guidance-adm.module.css";

export default function GuidanceAdmPage() {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;

  const { data: referrals, isPending, isError, refetch, isFetching } =
    useQuery<GuidanceReferralItem[]>({
      queryKey: ["guidance-adm", "report", termKey],
      queryFn: () => fetchAllGuidanceReferrals(),
      placeholderData: keepPreviousData,
      staleTime: 60_000,
    });

  const data = React.useMemo(
    () =>
      Array.isArray(referrals) ? buildGuidanceAdmReferrals(referrals) : null,
    [referrals]
  );

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
  } = useQuery<Record<string, GuidanceRiskLevel>>({
    queryKey: ["guidance-risk-levels", studentIds, termKey],
    queryFn: () => fetchGuidanceRiskLevels(studentIds),
    placeholderData: keepPreviousData,
    staleTime: 300_000,
    enabled: studentIds.length > 0,
  });

  const insights = React.useMemo(
    () => (data ? buildGuidanceAdmInsights(data.desk, riskByStudent ?? {}) : null),
    [data, riskByStudent]
  );

  if (isPending) {
    return (
      <section className={pageStyles.page} aria-busy="true" aria-label="Loading referrals report">
        <div className={styles.skelFindings} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className={styles.skelFinding} />
          ))}
        </div>
        <div
          aria-hidden="true"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(17rem, 1fr))", gap: "1rem" }}
        >
          <Card>
            <CardContent>
              <Skeleton style={{ width: "45%", height: "0.9375rem" }} />
              <Skeleton style={{ width: "75%", height: "0.8125rem", marginTop: "0.125rem" }} />
              <Skeleton style={{ width: "100%", height: "168px", marginTop: "0.75rem" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginTop: "0.5rem" }}>
                {[0, 1, 2, 3, 4].map((j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <Skeleton style={{ width: "6rem", height: "0.8125rem" }} />
                    <Skeleton style={{ width: "2rem", height: "0.8125rem" }} />
                  </div>
                ))}
              </div>
              <Skeleton style={{ width: "100%", height: "2.25rem", marginTop: "0.625rem", paddingLeft: "0.625rem" }} />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Skeleton style={{ width: "45%", height: "0.9375rem" }} />
              <Skeleton style={{ width: "75%", height: "0.8125rem", marginTop: "0.125rem" }} />

              <Skeleton style={{ width: "100%", height: "200px", marginTop: "0.75rem" }} />
              <Skeleton style={{ width: "100%", height: "2.25rem", marginTop: "0.625rem", paddingLeft: "0.625rem" }} />
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={pageStyles.page}>
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            We couldn&apos;t load the referrals report. Please check your internet
            connection and try again.
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
            {isFetching ? "Loading…" : "Try again"}
          </Button>
        </div>
      </section>
    );
  }

  const refreshing = isFetching && !isPending;

  return (
    <section className={pageStyles.page} aria-busy={refreshing}>
      {refreshing ? <RefreshBadge label="Refreshing referrals report…" /> : null}
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
      {insights ? <GuidanceAdmInsights data={insights} /> : null}
      <GuidanceAdmReports data={data} />
    </section>
  );
}
