"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { NurseReferralsTable } from "./components/NurseReferralsTable";
import { NurseRefreshBadge } from "../components/nurse-refresh-badge";
import { fetchNurseAlerts } from "@/services/nurse/alerts.service";
import { fetchNurseRiskLevels } from "@/services/nurse/risk.service";
import type {
  NurseAlertsPage,
  NurseRiskLevel,
} from "@/services/nurse/nurse.types";
import { useNurseInvalidate } from "../overview/components/use-nurse-mutation";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useTerm } from "@/lib/term/TermContext";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./components/nurse-alerts.module.css";

const NURSE_ALERTS_PAGE_SIZE = 15;

export default function NurseAlertsPage() {
  const invalidateNurse = useNurseInvalidate();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  // Debounced 300ms so server queries fire after the user pauses typing.
  const debounced = useDebouncedValue(query.trim(), 300);

  const { data, isPending, isError, refetch, isFetching } =
    useQuery<NurseAlertsPage>({
      queryKey: ["nurse-alerts", page, debounced, termKey],
      queryFn: ({ signal }) =>
        fetchNurseAlerts({
          q: debounced || undefined,
          page,
          pageSize: NURSE_ALERTS_PAGE_SIZE,
          signal,
        }),
      // Page turns reuse the previous page so they never flash skeletons.
      placeholderData: keepPreviousData,
      staleTime: 60_000,
    });

  // Derived, never setState-in-effect: the server clamps too, this keeps
  // the pager truthful while a filter shrinks the list under the cursor.
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const safePage = Math.min(page, totalPages);

  // Live rule-based risk level per student behind these cases (account id
  // or roster id — the endpoint serves both).
  const studentIds = React.useMemo(
    () => [
      ...new Set(
        (data?.alerts ?? [])
          .map((a) => a.studentId)
          .filter((id): id is string => id !== null)
      ),
    ].sort(),
    [data]
  );
  const {
    data: riskByStudent,
    isPending: riskPending,
    isFetching: riskFetching,
    isError: riskError,
    refetch: refetchRisk,
  } = useQuery<Record<string, NurseRiskLevel>>({
    queryKey: ["nurse-risk-levels", studentIds, termKey],
    queryFn: () => fetchNurseRiskLevels(studentIds),
    staleTime: 300_000,
    enabled: studentIds.length > 0,
  });
  const riskLoading = studentIds.length > 0 && (riskPending || riskFetching);

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true">
        <div className={assign.card}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelPanelDesc} />
            </div>
            <div className={styles.skelPanelActions}>
              <Skeleton className={styles.skelSearch} />
              <Skeleton className={styles.skelDrop} />
            </div>
          </div>
          <div className="relative overflow-x-auto rounded-md border p-2">
            <div className={styles.skelThead} aria-hidden="true">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <Skeleton key={i} className={styles.skelTheadCell} />
              ))}
            </div>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className={styles.skelRow} />
            ))}
          </div>
          <div className="relative flex items-center justify-end gap-2">
            <Skeleton className={styles.skelRange} />
            <Skeleton className={styles.skelBtn} />
            <Skeleton className={styles.skelBtn} />
          </div>
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <div className={styles.pageError} role="alert">
          <p className={styles.pageErrorTitle}>We couldn&apos;t load the referred cases</p>
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

  // Background refetch: keep data visible, show a subtle indicator.
  // Risk levels load independently — the table renders with "—" shimmer
  // state instead of blocking, and surfaces retry on failure.
  const refreshing = isFetching && !isPending;

  return (
    <section className={styles.page} aria-busy={refreshing}>
      {/* Floating pill — never shifts the table. */}
      {refreshing ? <NurseRefreshBadge label="Refreshing cases…" /> : null}
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
      <NurseReferralsTable
        alerts={Array.isArray(data.alerts) ? data.alerts : []}
        riskByStudent={riskByStudent ?? {}}
        riskLoading={riskLoading}
        query={query}
        onQueryChange={(v) => {
          setQuery(v);
          setPage(1);
        }}
        page={safePage}
        totalPages={totalPages}
        total={data.total}
        unfilteredTotal={data.unfilteredTotal}
        onPageChange={setPage}
        serverPaged
        onChanged={() => {
          invalidateNurse();
        }}
      />
    </section>
  );
}
