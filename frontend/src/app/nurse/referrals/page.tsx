"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { NurseAlertsTable } from "./components/NurseAlertsTable";
import { NurseReferralsSkeleton } from "./components/NurseReferralsSkeleton";
import { fetchNurseAlerts } from "../alerts/components/nurse-alerts-data";
import styles from "./nurse-referrals-page.module.css";

/**
 * Referrals to me — every case advisers sent to the school nurse (clinic
 * matters and ADM consultations), newest first, in a timeline layout.
 * A case-type filter switches between clinic matters and ADM
 * consultations.
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
      <section className={styles.page}>
        <NurseReferralsSkeleton />
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
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
            Try again
          </Button>
        </div>
      </section>
    );
  }

  // Referrals to me = everything on the nurse's desk (clinic matters plus
  // ADM consultations picked for the nurse). The table's case-type filter
  // narrows between the two.
  const allAlerts = data.alerts;

  return (
    <section className={styles.page}>
      <NurseAlertsTable alerts={allAlerts} onChanged={refresh} />
    </section>
  );
}
