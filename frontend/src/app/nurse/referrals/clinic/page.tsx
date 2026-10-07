"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { NurseAlertsTable } from "../components/NurseAlertsTable";
import { NurseReferralsSkeleton } from "../components/NurseReferralsSkeleton";
import { NurseRefreshBadge } from "../../components/nurse-refresh-badge";
import { fetchNurseAlerts } from "@/services/nurse/alerts.service";
import type { NurseAlertsPage } from "@/services/nurse/nurse.types";
import { useNurseInvalidate } from "../../overview/components/use-nurse-mutation";
import { useTerm } from "@/lib/term/TermContext";
import styles from "../nurse-referrals-page.module.css";

const NURSE_CLINIC_PAGE_SIZE = 15;

/**
 * Clinic Matters — every clinic matter sent to the school nurse, newest
 * first. Locked to the Clinic type so no case-type filter is needed.
 * Server track-filtered (?track=clinic) + server-paginated (15/page,
 * previous page kept so turns never flash skeletons).
 *
 * Deep-links from the bell (?highlight=<id>) serve the case's own page
 * (?highlight=) and scroll to it; the first pager touch takes over with
 * plain ?track=&page=. Derived — no setState in effects.
 */
function NurseClinicReferralsView() {
  const params = useSearchParams();
  const highlightId = params.get("highlight");
  const invalidateNurse = useNurseInvalidate();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [page, setPage] = React.useState(1);
  const [takeover, setTakeover] = React.useState(false);
  const landing = !takeover && highlightId !== null;

  const { data, isPending, isError, refetch, isRefetching } =
    useQuery<NurseAlertsPage>({
      queryKey: [
        "nurse-alerts",
        "clinic",
        takeover ? page : 1,
        termKey,
        landing ? (highlightId ?? "") : "",
      ],
      queryFn: ({ signal }) =>
        fetchNurseAlerts({
          track: "clinic",
          page: takeover ? page : 1,
          pageSize: NURSE_CLINIC_PAGE_SIZE,
          ...(landing && highlightId ? { highlight: highlightId } : {}),
          signal,
        }),
      placeholderData: keepPreviousData,
      staleTime: 60_000,
    });

  // Derived, never setState-in-effect.
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const safePage = Math.min(data?.page ?? page, totalPages);

  function refresh() {
    invalidateNurse();
  }

  if (isPending) {
    return (
      <section className={styles.page}>
        <NurseReferralsSkeleton sideRows={5} />
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
        alerts={Array.isArray(data.alerts) ? data.alerts : []}
        onChanged={refresh}
        initialType="Clinic"
        lockType
        title="Clinic Matters"
        highlightId={highlightId}
        serverPage={safePage}
        serverTotalPages={totalPages}
        serverTotal={data.total}
        serverUnfilteredTotal={data.unfilteredTotal}
        onServerPageChange={(p) => {
          setTakeover(true);
          setPage(p);
        }}
      />
    </section>
  );
}

export default function NurseClinicReferralsPage() {
  return (
    <React.Suspense
      fallback={
        <section className={styles.page}>
          <NurseReferralsSkeleton sideRows={5} />
        </section>
      }
    >
      <NurseClinicReferralsView />
    </React.Suspense>
  );
}
