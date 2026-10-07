"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldQuestion } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  HistoryTable,
  PendingDecisionTable,
  TableSkeleton,
} from "./components/AdviserAccessTables";
import { apiClient } from "@/lib/api/client";
import { markSelfNotified } from "@/lib/realtime/registrarChannel";
import type { AdviserAccessRequest } from "./components/types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./adviser-access.module.css";

type RequestsResponse = { requests: AdviserAccessRequest[] };

const QUERY_KEY = ["adviser-access-requests"];

async function fetchRequests() {
  return apiClient
    .get<RequestsResponse>("/api/registrar/adviser-access-requests")
    .then((res) => res.data.requests);
}

export default function AdviserAccessPage() {
  const qc = useQueryClient();
  const { data, isPending, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchRequests,
  });

  const requests = React.useMemo(() => data ?? [], [data]);

  const act = useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      apiClient.post(
        `/api/registrar/adviser-access-requests/${id}/${approved(approve)}`,
        approve ? {} : { reason: reason ?? "Denied by registrar" }
      ),
    // Pessimistic: the request stays Pending (with its spinner) until the
    // server confirms — the settled refetch below is what moves it to
    // history. No optimistic flip: the UI must never outrun the processing.
    onError: (err) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response
          ?.data?.error?.message ?? "Could not decide this request.";
      toast.error({ title: "Action failed", description: message });
    },
    onSuccess: (_data, { id, approve }) => {
      // Self-receipt lands in our own bell (badge bumps live); suppress its
      // echo toast — the toast below already confirmed the action.
      markSelfNotified(id);
      // Names from the still-present cache (row moves only via refetch).
      const target = qc
        .getQueriesData<RequestsResponse>({ queryKey: QUERY_KEY })
        .flatMap(([, d]) => d?.requests ?? [])
        .find((r) => r.id === id);
      const name = target?.adviserName ?? "Adviser";
      const section = target?.section ? ` (${target.section})` : "";
      toast.success({
        title: approve ? "Access granted" : "Access denied",
        description: approve
          ? `${name}${section} can now read the SF10 set.`
          : `${name}${section} was denied.`,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["registrar-overview"] });
      qc.invalidateQueries({ queryKey: ["registrar-notifications"] });
    },
  });

  const [acting, setActing] = React.useState<{ id: string; approve: boolean } | null>(null);

  const handleActed = React.useCallback(
    async (id: string, approved: boolean, reason?: string) => {
      setActing({ id, approve: approved });
      try {
        await act.mutateAsync({ id, approve: approved, reason });
      } finally {
        setActing(null);
      }
    },
    [act],
  );

  const grouped = React.useMemo(() => {
    const g: Record<"pending" | "approved" | "denied", AdviserAccessRequest[]> = {
      pending: [],
      approved: [],
      denied: [],
    };
    requests.forEach((r) => g[r.status].push(r));
    return g;
  }, [requests]);

  const history = React.useMemo(
    () => [...grouped.approved, ...grouped.denied],
    [grouped]
  );

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
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    <TableHead>Adviser</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Advisees</TableHead>
                    <TableHead>SF10 Ready</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableSkeleton columns={8} />
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      </section>
    );
  }

  if (requests.length === 0) {
    return (
      <section className={styles.page}>
        <div className={styles.emptyWrap}>
          <section className={`${assign.card} ${styles.emptyCard}`} aria-label="No access requests">
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <div className={`${styles.empty} relative`}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <ShieldQuestion />
              </span>
              <p className={styles.emptyTitle}>No adviser access requests</p>
              <p className={styles.emptyHint}>
                No adviser access requests for grades 11–12.
              </p>
            </div>
          </section>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.stack}>
        <section className={assign.card} aria-label="Access requests summary">
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <ul className={`${styles.tiles} relative`}>
            <li className={styles.tile}>
              <span className={styles.tileValue}>{grouped.pending.length}</span>
              <span className={styles.tileLabel}>Pending</span>
              <span className={styles.tileHint}>Awaiting your decision</span>
            </li>
            <li className={styles.tile}>
              <span className={styles.tileValue}>{grouped.approved.length}</span>
              <span className={styles.tileLabel}>Approved</span>
              <span className={styles.tileHint}>SF10 read access granted</span>
            </li>
            <li className={styles.tile}>
              <span className={styles.tileValue}>{grouped.denied.length}</span>
              <span className={styles.tileLabel}>Denied</span>
              <span className={styles.tileHint}>SF10 read access not granted</span>
            </li>
            <li className={styles.tile}>
              <span className={styles.tileValue}>{requests.length}</span>
              <span className={styles.tileLabel}>Total requests</span>
              <span className={styles.tileHint}>Grades 11–12 this school year</span>
            </li>
          </ul>
        </section>

        <PendingDecisionTable
          requests={grouped.pending}
          actingId={acting?.id ?? null}
          actingApprove={acting?.approve ?? null}
          onActed={handleActed}
        />

        <HistoryTable requests={history} />
      </div>
    </section>
  );
}

function approved(approve: boolean) {
  return approve ? "approve" : "deny";
}
