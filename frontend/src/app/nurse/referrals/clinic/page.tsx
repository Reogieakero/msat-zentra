"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { NurseAlertsTable } from "../components/NurseAlertsTable";
import { NurseReferralsSkeleton } from "../components/NurseReferralsSkeleton";
import { NurseRefreshBadge } from "../../components/nurse-refresh-badge";
import { fetchNurseAlerts } from "../../alerts/components/nurse-alerts-data";
import styles from "../nurse-referrals-page.module.css";

/**
 * Clinic Matters — every clinic matter sent to the school nurse, newest
 * first. Locked to the Clinic type so no case-type filter is needed.
 *
 * Deep-links from the alerts table (?highlight=<id>) scroll to and
 * highlight the case on arrival.
 */
function NurseClinicReferralsView() {
  const params = useSearchParams();
  const highlightId = params.get("highlight");
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch, isRefetching } = useQuery({
    queryKey: ["nurse-alerts"],
    queryFn: fetchNurseAlerts,
    staleTime: 60_000,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["nurse-alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["nurse-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["nurse-risk"] });
    void queryClient.invalidateQueries({ queryKey: ["nurse-risk-levels"] });
  }

  if (isPending) {
    return (
      <section className={styles.page}>
        <NurseReferralsSkeleton lockType sideRows={4} />
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <div className={styles.pageError} role="alert">
          <p className={styles.pageErrorTitle}>We couldn&apos;t load your clinic matters</p>
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

  const refreshing = isRefetching && !isPending;

  return (
    <section className={styles.page} aria-busy={refreshing}>
      {refreshing ? <NurseRefreshBadge label="Refreshing clinic matters…" /> : null}
      <NurseAlertsTable
        alerts={data.alerts}
        onChanged={refresh}
        initialType="Clinic"
        lockType
        title="Clinic Matters"
        highlightId={highlightId}
      />
    </section>
  );
}

export default function NurseClinicReferralsPage() {
  return (
    <React.Suspense
      fallback={
        <section className={styles.page}>
          <NurseReferralsSkeleton lockType sideRows={4} />
        </section>
      }
    >
      <NurseClinicReferralsView />
    </React.Suspense>
  );
}
