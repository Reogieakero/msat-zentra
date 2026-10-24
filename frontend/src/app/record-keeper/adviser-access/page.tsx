"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Megaphone, ShieldQuestion, Users } from "lucide-react";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { AdviserAccessKanban } from "./components/AdviserAccessTables";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
import { markSelfNotified } from "@/lib/realtime/recordKeeperChannel";
import type { AdviserAccessRequest } from "./components/types";
import { getStudentListStats, mergeConfirmedMarks } from "@/components/shared/adviser-access/adviser-access-types";
import { useAdviserAccessCheck } from "@/components/shared/adviser-access/adviser-access-check-context";
import { RecordKeeperEmptyCard } from "../components/RecordKeeperEmptyCard";
import { Sf10RequestsRail } from "./components/Sf10RequestsRail";
import {
  AdviserAccessSummarySkeleton,
  AdviserAccessBoardSkeleton,
} from "@/components/shared/adviser-access/adviser-access-skeleton";
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
  const dock = useDock();
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
      let taskId: string | null = null;
      try {
        taskId = dock.startTask({ kind: "generic", title: "Denying adviser access", description: "Adviser access request" });
      } catch {
        taskId = null;
      }
      try {
        await deny.mutateAsync({ id, reason });
        if (taskId) dock.completeTask(taskId, "Access request denied.");
      } catch {
        if (taskId) dock.failTask(taskId, "Could not deny this request.");
      } finally {
        setDenyingId(null);
      }
    },
    [deny, dock],
  );

  const pendingRequests = React.useMemo(() => requests.filter((r) => r.status === "pending"), [requests]);

  // KPI is pure student-list counts over pending requests.
  const stats = React.useMemo(() => getStudentListStats(pendingRequests), [pendingRequests]);

  // Kanban stat columns — same column chrome as the Request Board below
  // (tinted column, bordered head, white stat card). Column mascots are
  // deliberately distinct from the overview board's cast (owl / scout /
  // knight / postbot) and the final-grades strip (scientist / rocket /
  // cap), and sit on the left of the number (final-grades puts them right).
  const summaryColumns = [
    {
      key: "pendingChecking",
      label: "Pending checking",
      value: stats.pendingChecking,
      hint: "Students awaiting Check",
      title: "Students in requests not yet checked",
      icon: <Clock size={14} className="text-amber-500" aria-hidden />,
      mascot: "glasses",
    },
    {
      key: "approved",
      label: "Approved",
      value: stats.approved,
      hint: "Decided in the check card",
      title: "Students granted from the check card (bottom-right) after verification",
      icon: <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" aria-hidden />,
      mascot: "panda",
    },
    {
      key: "reportedMissing",
      label: "Reported missing",
      value: stats.reportedMissing,
      hint: "Decided in the check card",
      title: "Students with no record, reported from the check card",
      icon: <Megaphone size={14} className="text-red-600 dark:text-red-400" aria-hidden />,
      mascot: "raccoon",
    },
    {
      key: "totalRequested",
      label: "Total requested",
      value: stats.totalRequested,
      hint: "Grades 7–10 this school year",
      title: "All students across pending requests",
      icon: <Users size={14} className="text-blue-500" aria-hidden />,
      mascot: "robot",
    },
  ];

  if (isError) {
    return (
      <section className={styles.page}>
        <div className={styles.layout}>
          <div className={styles.stack}>
            <p className={styles.error}>Failed to load access requests.</p>
          </div>
          <Sf10RequestsRail />
        </div>
      </section>
    );
  }

  if (isPending) {
    return (
      <section className={styles.page}>
        <div className={styles.layout}>
          <div className={styles.stack}>
            <AdviserAccessSummarySkeleton className={styles.summaryGrid} />
            <AdviserAccessBoardSkeleton />
          </div>
          <Sf10RequestsRail />
        </div>
      </section>
    );
  }

  if (requests.length === 0) {
    return (
      <section className={styles.page}>
        <div className={styles.layout}>
          <div className={styles.stack}>
            <RecordKeeperEmptyCard
              icon={ShieldQuestion}
              title="No adviser access requests"
              hint="No adviser access requests for grades 7–10."
              label="No access requests"
              centered
            />
          </div>
          <Sf10RequestsRail />
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.stack}>
          <section
            aria-label="Access requests summary"
            className={`${styles.summaryGrid} grid min-w-0 gap-2.5 sm:grid-cols-2 lg:grid-cols-4`}
          >
            {summaryColumns.map((col) => (
              <div
                key={col.key}
                title={col.title}
                aria-label={`${col.label}, ${col.value} students`}
                className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
              >
                <div className="-mx-2.5 flex items-center justify-between gap-2 border-b border-border px-3.5 pb-2">
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
                    {col.icon}
                    <span className="truncate">{col.label}</span>
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 rounded-lg border bg-white p-4 shadow-sm dark:bg-card">
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <span
                      className="inline-flex shrink-0 overflow-hidden rounded-full border border-border bg-muted/40"
                      aria-hidden="true"
                    >
                      <StudentMascot name={col.label} character={col.mascot} size={36} />
                    </span>
                    <span
                      className={`text-3xl font-bold tracking-tight tabular-nums ${
                        col.value === 0 ? "text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {col.value}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">{col.hint}</span>
                </div>
              </div>
            ))}
          </section>

          <AdviserAccessKanban
            requests={pendingRequests}
            onCheck={handleCheck}
            checkingId={checkingId}
            onDeny={handleDeny}
            denyingId={denyingId}
          />
        </div>
        <Sf10RequestsRail />
      </div>
    </section>
  );
}
