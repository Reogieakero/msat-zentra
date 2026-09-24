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
  const { data: riskByStudent } = useQuery({
    queryKey: ["nurse-risk-levels", studentIds],
    queryFn: () => fetchNurseRiskLevels(studentIds),
    staleTime: 300_000,
    enabled: studentIds.length > 0,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["nurse-alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["nurse-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["nurse-risk"] });
    void queryClient.invalidateQueries({ queryKey: ["nurse-risk-levels"] });
  }

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.grid} aria-hidden="true">
          <Card className={styles.card}>
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
            </CardContent>
          </Card>
          <Card className={styles.card}>
            <CardContent>
              <Skeleton style={{ width: "45%", height: "0.9375rem" }} />
              <Skeleton style={{ width: "75%", height: "0.8125rem", marginTop: "0.125rem" }} />
              <Skeleton style={{ width: "100%", height: "200px", marginTop: "0.75rem" }} />
            </CardContent>
          </Card>
        </div>

        <Card className={styles.card} aria-hidden="true">
          <CardContent>
            <Skeleton style={{ width: "12rem", height: "1.125rem" }} />
            <Skeleton style={{ width: "16rem", height: "0.8125rem", marginTop: "0.25rem" }} />
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", padding: "0.5rem" }}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} style={{ height: "0.6875rem", flex: 1 }} />
              ))}
            </div>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} style={{ height: "3.625rem", width: "100%", marginTop: "0.25rem" }} />
            ))}
          </CardContent>
        </Card>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            We couldn&apos;t load the ADM referrals. Please check your internet
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

  return (
    <section className={styles.page}>
      <NurseAdmReports data={data} />

      <NurseAdmQueueTable
        queue={data.queue}
        riskByStudent={riskByStudent ?? {}}
        onChanged={refresh}
      />
    </section>
  );
}
