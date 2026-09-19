"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { NurseAlertsTable } from "../components/NurseAlertsTable";
import { NurseReferralsSkeleton } from "../components/NurseReferralsSkeleton";
import { fetchNurseAlerts } from "../../alerts/components/nurse-alerts-data";
import styles from "../nurse-referrals-page.module.css";

/**
 * ADM Cases — every ADM consultation sent to the school nurse, newest
 * first. Locked to the ADM type so no case-type filter is needed.
 *
 * Deep-links from the alerts table (?highlight=<id>[&form=1]) scroll to
 * and highlight the case, overlaying the filled referral form when asked.
 */
function NurseAdmReferralsView() {
  const params = useSearchParams();
  const highlightId = params.get("highlight");
  const autoViewFormId = params.get("form") === "1" ? params.get("highlight") : null;
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
          <p className={styles.pageErrorTitle}>We couldn&apos;t load your ADM cases</p>
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

  return (
    <section className={styles.page}>
      <NurseAlertsTable
        alerts={data.alerts}
        onChanged={refresh}
        initialType="ADM"
        lockType
        title="ADM Cases"
        highlightId={highlightId}
        autoViewFormId={autoViewFormId}
      />
    </section>
  );
}

export default function NurseAdmReferralsPage() {
  return (
    <React.Suspense
      fallback={
        <section className={styles.page}>
          <NurseReferralsSkeleton />
        </section>
      }
    >
      <NurseAdmReferralsView />
    </React.Suspense>
  );
}
