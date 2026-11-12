"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { Button } from "@/components/ui/button";
import { CoordinatorCertificationsFolders } from "./components/coordinator-certifications-folders";
import { CoordinatorCertificationsSkeleton } from "./components/coordinator-certifications-skeleton";
import { CoordinatorCertificationsRail } from "./components/coordinator-certifications-rail";
import {
  fetchCertApprovalRows,
  fetchCertStageRows,
  mergeCertRecords,
  summarizeCertRecords,
} from "@/services/coordinator/certifications.service";
import type { CertStatusFilter } from "@/services/coordinator/certifications.types";
import styles from "./components/coordinator-certifications.module.css";

function tabToStatus(tab: string | null): CertStatusFilter {
  if (tab === "awaiting" || tab === "revision" || tab === "approved" || tab === "prepared") {
    return tab;
  }
  return "all";
}

function CertificationsBody() {
  const params = useSearchParams();
  const [queryInput, setQueryInput] = React.useState("");

  const query = useDebouncedValue(queryInput.trim(), 300);
  const [status, setStatus] = React.useState<CertStatusFilter>(() =>
    tabToStatus(params.get("tab")),
  );

  const handleQueryInputChange = (value: string) => {
    setQueryInput(value);
  };

  const certQuery = useQuery({
    queryKey: ["coordinator-certifications", "certification", query],
    queryFn: ({ signal }) => fetchCertStageRows("certification", query, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const approvalQuery = useQuery({
    queryKey: ["coordinator-certifications", "principal_approval", query],
    queryFn: ({ signal }) =>
      fetchCertStageRows("principal_approval", query, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const approvedQuery = useQuery({
    queryKey: ["coordinator-certifications", "approved", query],
    queryFn: ({ signal }) => fetchCertApprovalRows(query, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const records = React.useMemo(
    () =>
      mergeCertRecords(
        [
          ...(Array.isArray(certQuery.data) ? certQuery.data : []),
          ...(Array.isArray(approvalQuery.data) ? approvalQuery.data : []),
        ],
        Array.isArray(approvedQuery.data) ? approvedQuery.data : [],
      ),
    [certQuery.data, approvalQuery.data, approvedQuery.data],
  );
  const summary = React.useMemo(() => summarizeCertRecords(records), [records]);

  const isPending =
    (certQuery.isPending || approvalQuery.isPending || approvedQuery.isPending) &&
    records.length === 0 &&
    certQuery.data === undefined &&
    approvalQuery.data === undefined &&
    approvedQuery.data === undefined;
  const isFetching =
    certQuery.isFetching || approvalQuery.isFetching || approvedQuery.isFetching;
  const isError =
    (certQuery.isError || approvalQuery.isError || approvedQuery.isError) &&
    records.length === 0;

  const refetchAll = () => {
    void certQuery.refetch();
    void approvalQuery.refetch();
    void approvedQuery.refetch();
  };

  if (isPending) {
    return <CoordinatorCertificationsSkeleton />;
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

  const trulyEmpty =
    records.length === 0 && query.trim() === "" && status === "all";

  return (
    <section
      className={trulyEmpty ? `${styles.page} ${styles.pageEmpty}` : styles.page}
      aria-label="Certifications"
    >
      <div className={trulyEmpty ? `${styles.layout} ${styles.layoutEmpty}` : styles.layout}>

        <div className={styles.main}>
          <CoordinatorCertificationsFolders
            records={records}
            query={queryInput}
            onQueryChange={handleQueryInputChange}
            status={status}
            onStatusChange={setStatus}
            isSyncing={isFetching}
          />
        </div>

        {trulyEmpty ? null : <CoordinatorCertificationsRail summary={summary} />}
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
