"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldQuestion } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AdviserAccessKanban } from "./components/AdviserAccessTables";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/recordKeeperChannel";
import type { AdviserAccessRequest } from "./components/types";
import { getStudentListStats, mergeConfirmedMarks } from "@/components/shared/adviser-access/adviser-access-types";
import { useAdviserAccessCheck } from "@/components/shared/adviser-access/adviser-access-check-context";
import { RecordKeeperEmptyCard } from "../components/RecordKeeperEmptyCard";
import { RecordKeeperPageHeader } from "../components/RecordKeeperPageHeader";
import { PageHeaderSkeleton } from "@/app/principal/components/skeletons/PageHeaderSkeleton";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./adviser-access.module.css";

type RequestsResponse = { requests: AdviserAccessRequest[] };

const QUERY_KEY = ["record-keeper-adviser-access"];

async function fetchRequests() {
  return apiClient
    .get<RequestsResponse>("/api/record-keeper/adviser-access-requests")
    .then((res) => mergeConfirmedMarks(res.data.requests));
}

export default function AdviserAccessPage() {
  const qc = useQueryClient();
  const { data, isPending, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchRequests,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const requests = React.useMemo(() => data ?? [], [data]);

  // Whole-request Deny only — kept as a secondary action in the kanban.
  const deny = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/api/record-keeper/adviser-access-requests/${id}/deny`, {
        reason: reason ?? "Denied by record keeper",
      }),
    onSuccess: (_data, { id }) => {
      markSelfNotified(id);
      toast.success({
        title: "Access denied",
        description: "The access request was denied.",
      });
    },
    onError: (err) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Could not deny this request.";
      toast.error({ title: "Action failed", description: message });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["record-keeper-overview"] });
      qc.invalidateQueries({ queryKey: ["record-keeper-notifications"] });
    },
  });

  const [denyingId, setDenyingId] = React.useState<string | null>(null);
  // Verification runs in the root-level dock (survives page navigation).
  const accessCheck = useAdviserAccessCheck();
  const checkingId = accessCheck.checkingId;

  const handleCheck = React.useCallback(
    (id: string) => {
      accessCheck.startCheck("record-keeper", id);
    },
    [accessCheck],
  );

  const handleDeny = React.useCallback(
    async (id: string, reason: string) => {
      setDenyingId(id);
      try {
        await deny.mutateAsync({ id, reason });
      } finally {
        setDenyingId(null);
      }
    },
    [deny],
  );

  const pendingRequests = React.useMemo(() => requests.filter((r) => r.status === "pending"), [requests]);

  // KPI is pure student-list counts over pending requests.
  const stats = React.useMemo(() => getStudentListStats(pendingRequests), [pendingRequests]);

  if (isError) {
    return (
      <section className={styles.page}>
        <div className={styles.stack}>
          <p className={styles.error}>Failed to load access requests.</p>
        </div>
      </section>
    );
  }

  if (isPending) {
    return (
      <section className={styles.page}>
        <div className={styles.stack}>
          <PageHeaderSkeleton />
          <section className={assign.card} aria-label="Access requests loading">
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <ul className={`${styles.tiles} relative`}>
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className={styles.tileSkel} />
                </li>
              ))}
            </ul>
          </section>
          <section className={assign.card} aria-label="Pending requests loading">
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <div className="relative grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    );
  }

  if (requests.length === 0) {
    return (
      <section className={styles.page}>
        <RecordKeeperEmptyCard
          icon={ShieldQuestion}
          title="No adviser access requests"
          hint="No adviser access requests for grades 7–10."
          label="No access requests"
          centered
        />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.stack}>
        <RecordKeeperPageHeader
          title="Adviser Access Requests"
          description="Check requests, then approve or report per student in the check card."
        />
        <section className={assign.card} aria-label="Access requests summary">
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <ul className={`${styles.tiles} relative`}>
            <li className={styles.tile} title="Students in requests not yet checked">
              <span className={styles.tileValue}>{stats.pendingChecking}</span>
              <span className={styles.tileLabel}>Pending checking</span>
              <span className={styles.tileHint}>Students awaiting Check</span>
            </li>
            <li
              className={styles.tile}
              title="Students granted from the check card (bottom-right) after verification"
            >
              <span className={styles.tileValue}>{stats.approved}</span>
              <span className={styles.tileLabel}>Approved</span>
              <span className={styles.tileHint}>Decided in the check card</span>
            </li>
            <li className={styles.tile} title="Students with no record, reported from the check card">
              <span className={styles.tileValue}>{stats.reportedMissing}</span>
              <span className={styles.tileLabel}>Reported missing</span>
              <span className={styles.tileHint}>Decided in the check card</span>
            </li>
            <li className={styles.tile} title="All students across pending requests">
              <span className={styles.tileValue}>{stats.totalRequested}</span>
              <span className={styles.tileLabel}>Total requested</span>
              <span className={styles.tileHint}>Grades 7–10 this school year</span>
            </li>
          </ul>
        </section>

        <AdviserAccessKanban
          requests={pendingRequests}
          onCheck={handleCheck}
          checkingId={checkingId}
          onDeny={handleDeny}
          denyingId={denyingId}
        />
      </div>
    </section>
  );
}
