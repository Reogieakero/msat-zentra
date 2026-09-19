"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { NurseReferralsTable } from "./components/NurseReferralsTable";
import { fetchNurseAlerts, fetchNurseRiskLevels } from "./components/nurse-alerts-data";
import styles from "./components/nurse-alerts.module.css";

export default function NurseAlertsPage() {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery({
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
  const { data: riskByStudent } = useQuery({
    queryKey: ["nurse-risk-levels", studentIds],
    queryFn: () => fetchNurseRiskLevels(studentIds),
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
              <Skeleton className={styles.skelDrop} />
            </div>
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className={styles.skelRow} />
          ))}
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
        <p className={styles.error}>Could not load alerts.</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <NurseReferralsTable
        alerts={data.alerts}
        riskByStudent={riskByStudent ?? {}}
        onChanged={() => {
          void queryClient.invalidateQueries({ queryKey: ["nurse-alerts"] });
          void queryClient.invalidateQueries({ queryKey: ["nurse-overview"] });
        }}
      />
    </section>
  );
}
