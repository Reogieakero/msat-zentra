"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { NurseAlertsTable } from "./components/NurseAlertsTable";
import { fetchNurseAlerts } from "../alerts/components/nurse-alerts-data";
import pageStyles from "@/app/guidance/pages.module.css";
import styles from "@/app/guidance/referrals/components/guidance-referrals.module.css";

/**
 * Referrals to me — every clinic matter advisers sent to the school nurse,
 * newest first, in the same timeline layout as the guidance referrals-to-me
 * page. ADM-track consultations live on the overview queue instead.
 */
export default function NurseReferralsPage() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch, isRefetching } = useQuery({
    queryKey: ["nurse-alerts"],
    queryFn: fetchNurseAlerts,
    staleTime: 60_000,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["nurse-alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["nurse-overview"] });
  }

  if (isPending) {
    return (
      <section className={pageStyles.page} aria-busy="true">
        <div className={pageStyles.header}>
          <div>
            <p className={pageStyles.eyebrow}>School Nurse · Referrals</p>
            <h1 className={pageStyles.title}>Referrals to me</h1>
            <p className={pageStyles.lede}>Loading the cases sent to the clinic…</p>
          </div>
        </div>
        <div className={styles.skelTimeline}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skelEntry}>
              <Skeleton className={styles.skelRail} />
              <Skeleton className={styles.skelBody} />
              <Skeleton className={styles.skelAside} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={pageStyles.page}>
        <div className={styles.pageError} role="alert">
          <p className={styles.pageErrorTitle}>We couldn&apos;t load your cases</p>
          <p className={styles.pageErrorHint}>
            Please check your internet connection and try again.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={isRefetching}
            onClick={() => refetch()}
          >
            {isRefetching ? (
              <Loader2 className={styles.spin} aria-hidden="true" />
            ) : null}
            {isRefetching ? "Loading…" : "Try again"}
          </Button>
        </div>
      </section>
    );
  }

  // Referrals to me = clinic matters only; ADM consultations stay on the
  // overview queue (same split as the guidance referrals/ADM pages).
  const clinicAlerts = data.alerts.filter((a) => a.row.type !== "ADM");

  return (
    <section className={pageStyles.page}>
      <div className={pageStyles.header}>
        <div>
          <p className={pageStyles.eyebrow}>School Nurse · Referrals</p>
          <h1 className={pageStyles.title}>Referrals to me</h1>
          <p className={pageStyles.lede}>
            {clinicAlerts.length === 0
              ? "Nothing sent to the clinic right now."
              : `${clinicAlerts.length} clinic case${clinicAlerts.length === 1 ? "" : "s"} sent to you by advisers.`}
          </p>
        </div>
      </div>

      <NurseAlertsTable alerts={clinicAlerts} onChanged={refresh} />
    </section>
  );
}
