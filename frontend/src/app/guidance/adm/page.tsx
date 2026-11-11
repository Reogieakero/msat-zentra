"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTerm } from "@/lib/term/TermContext";
import { liveQueryOptions } from "@/lib/api/live";
import { FileBarChart2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuidanceEmptyCard } from "../components/GuidanceEmptyCard";
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
import {
  GuidanceAdmInsights,
  GuidanceAdmStats,
} from "./components/GuidanceAdmInsights";
import { GuidanceAdmRisk } from "./components/GuidanceAdmRisk";
import { GuidanceAdmReports } from "./components/guidance-adm-reports";
import { GuidanceAdmSkeleton } from "./components/GuidanceAdmSkeleton";
import pageStyles from "../pages.module.css";
import styles from "./components/guidance-adm.module.css";

export default function GuidanceAdmPage() {
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;

  const { data: referrals, isPending, isError, refetch, isFetching } =
    useQuery<GuidanceReferralItem[]>({
      ...liveQueryOptions,
      queryKey: ["guidance-adm", "report", termKey],
      queryFn: () => fetchAllGuidanceReferrals(),
      placeholderData: keepPreviousData,
      enabled: termReady,
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
    ...liveQueryOptions,
    queryKey: ["guidance-risk-levels", studentIds, termKey],
    queryFn: () => fetchGuidanceRiskLevels(studentIds),
    placeholderData: keepPreviousData,
    enabled: termReady && studentIds.length > 0,
  });

  const insights = React.useMemo(
    () => (data ? buildGuidanceAdmInsights(data.desk, riskByStudent ?? {}) : null),
    [data, riskByStudent]
  );

  if (isPending) {
    return <GuidanceAdmSkeleton />;
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
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
  const isTrueEmpty = (data?.desk.length ?? 0) === 0;

  return (
    <section
      className={isTrueEmpty ? `${styles.page} ${pageStyles.pageFit}` : styles.page}
      aria-busy={refreshing}
      aria-label="Referrals report"
    >
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
      {isTrueEmpty ? (
        <GuidanceEmptyCard
          icon={FileBarChart2}
          title="No referrals this term"
          hint="Referral trends and outcomes will appear here once cases are filed."
          label="Referrals report"
          centered
          layout="fit"
        />
      ) : (
        <>
          {insights ? (
            <>
              <GuidanceAdmStats data={insights} />
              <GuidanceAdmReports data={data} insights={insights} />
              <GuidanceAdmInsights data={insights} />
              <GuidanceAdmRisk />
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
