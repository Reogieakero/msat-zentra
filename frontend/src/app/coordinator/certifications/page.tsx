"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CoordinatorCertificationsCharts } from "./components/coordinator-certifications-charts";
import { CoordinatorCertificationsGradeChart } from "./components/coordinator-certifications-grade";
import { CoordinatorCertificationsFolders } from "./components/coordinator-certifications-folders";
import {
  fetchCertApprovalRows,
  fetchCertStageRows,
  mergeCertRecords,
  summarizeCertRecords,
  type CertStatusFilter,
} from "./components/coordinator-certifications-data";
import styles from "./components/coordinator-certifications.module.css";

const PAGE_SIZE = 24;

function tabToStatus(tab: string | null): CertStatusFilter {
  if (tab === "awaiting" || tab === "revision" || tab === "approved" || tab === "prepared") {
    return tab;
  }
  return "all";
}

function CertificationsBody() {
  const params = useSearchParams();
  const [queryInput, setQueryInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<CertStatusFilter>(() =>
    tabToStatus(params.get("tab")),
  );
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(queryInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const handleQueryInputChange = (value: string) => {
    setQueryInput(value);
    setPage(1);
  };

  const certQuery = useQuery({
    queryKey: ["coordinator-certifications", "certification", query],
    queryFn: ({ signal }) => fetchCertStageRows("certification", query, signal),
    staleTime: 30_000,
  });
  const approvalQuery = useQuery({
    queryKey: ["coordinator-certifications", "principal_approval", query],
    queryFn: ({ signal }) =>
      fetchCertStageRows("principal_approval", query, signal),
    staleTime: 30_000,
  });
  const approvedQuery = useQuery({
    queryKey: ["coordinator-certifications", "approved", query],
    queryFn: ({ signal }) => fetchCertApprovalRows(query, signal),
    staleTime: 30_000,
  });

  const records = React.useMemo(
    () =>
      mergeCertRecords(
        [...(certQuery.data ?? []), ...(approvalQuery.data ?? [])],
        approvedQuery.data ?? [],
      ),
    [certQuery.data, approvalQuery.data, approvedQuery.data],
  );
  const summary = React.useMemo(() => summarizeCertRecords(records), [records]);

  const isPending =
    certQuery.isPending || approvalQuery.isPending || approvedQuery.isPending;
  const isFetching =
    certQuery.isFetching || approvalQuery.isFetching || approvedQuery.isFetching;
  const isError =
    certQuery.isError || approvalQuery.isError || approvedQuery.isError;

  const refetchAll = () => {
    void certQuery.refetch();
    void approvalQuery.refetch();
    void approvedQuery.refetch();
  };

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.layout}>
          <div className={styles.side}>
            <div className={styles.skelCard}>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelCardDesc} />
              <Skeleton className={styles.skelChart} />
              <div className={styles.skelLegend}>
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className={styles.skelLegendRow}>
                    <Skeleton className={styles.skelLegendLabel} />
                    <Skeleton className={styles.skelLegendCount} />
                  </div>
                ))}
              </div>
              <Skeleton className={styles.skelInterpretation} />
            </div>
            <div className={styles.skelCard}>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelCardDesc} />
              <div className={styles.skelGradeBars}>
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className={styles.skelGradeRow}>
                    <Skeleton className={styles.skelGradeLabel} />
                    <Skeleton className={styles.skelGradeBar} />
                    <Skeleton className={styles.skelGradeCount} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.main}>
            <div className={styles.skelPanel}>
              <div className={styles.skelPanelHead}>
                <div className={styles.skelPanelHeadText}>
                  <div className={styles.skelPanelTitleRow}>
                    <Skeleton className={styles.skelPanelTitle} />
                    <Skeleton className={styles.skelHelpBtn} />
                  </div>
                  <Skeleton className={styles.skelPanelDesc} />
                </div>
                <div className={styles.skelPanelActions}>
                  <Skeleton className={styles.skelSearch} />
                  <Skeleton className={styles.skelDrop} />
                </div>
              </div>
              <div className={styles.skelFolderGrid}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className={styles.skelFolderCard}>
                    <Skeleton className={styles.skelFolderBadge} />
                    <Skeleton className={styles.skelFolder} />
                    <Skeleton className={styles.skelFolderLabel} />
                    <Skeleton className={styles.skelFolderSub} />
                  </div>
                ))}
              </div>
              <div className={styles.skelPager}>
                <Skeleton className={styles.skelRange} />
                <div className={styles.skelPagerBtns}>
                  <Skeleton className={styles.skelBtn} />
                  <Skeleton className={styles.skelPageLabel} />
                  <Skeleton className={styles.skelBtn} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>
          Could not load the certifications. Please check your internet
          connection and try again.
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Button
            size="sm"
            variant="outline"
            disabled={isFetching}
            onClick={refetchAll}
          >
            {isFetching ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}
            {isFetching ? "Loading…" : "Try again"}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page} aria-label="Certifications">
      <div className={styles.layout}>
        <aside className={styles.side}>
          <CoordinatorCertificationsCharts summary={summary} />
          <CoordinatorCertificationsGradeChart summary={summary} />
        </aside>

        <div className={styles.main}>
          <CoordinatorCertificationsFolders
            records={records}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            query={queryInput}
            onQueryChange={handleQueryInputChange}
            status={status}
            onStatusChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            isNavigating={isFetching && !isPending}
          />
        </div>
      </div>
    </section>
  );
}

export default function CoordinatorCertificationsPage() {
  return (
    <React.Suspense
      fallback={<section className={styles.page} aria-busy="true" />}
    >
      <CertificationsBody />
    </React.Suspense>
  );
}
