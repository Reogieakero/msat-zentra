"use client";

import * as React from "react";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  X,
  UserPlus,
  SearchX,
  Clock,
  UserCheck,
  Layers,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
import { KanbanBoard, KanbanBoardHeader } from "@/components/ui/kanban-board";
import { RowList, type RowListItem } from "@/components/ui/row-list";
import { RowListSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { LrnVerifyButton } from "./components/LrnVerifyButton";
import { LrnVerifyDock } from "./components/LrnVerifyDock";
import { RecordKeeperEmptyCard, RecordKeeperEmptyState } from "../components/RecordKeeperEmptyCard";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { markSelfNotified } from "@/lib/realtime/recordKeeperChannel";
import type { AccountBreakdown } from "./components/AccountsBreakdown";
import { AccountsBreakdownRail } from "./components/AccountsBreakdownRail";
import { formatGrade, formatSection } from "@/lib/utils";
import type { PendingStudent, PendingStudentsResponse } from "./components/types";
import { formatRelativeTime } from "./components/types";
import styles from "./accounts.module.css";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
import { useSearchParams } from "next/navigation";

async function fetchPendingStudents(page: number, q: string, signal?: AbortSignal) {
  return apiClient
    .get<PendingStudentsResponse>("/api/auth/pending", {
      params: { role: "student", page, pageSize: PAGE_SIZE, ...(q ? { q } : {}) },
      signal,
    })
    .then((res) => res.data);
}

export default function AccountApprovalsPage() {
  return (
    <React.Suspense>
      <AccountApprovalsPageInner />
    </React.Suspense>
  );
}

function AccountApprovalsPageInner() {
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const dock = useDock();
  const [queryInput, setQueryInput] = React.useState(searchParams.get("q") ?? "");
  const pager = useUrlPager(0, {}, { searchParam: "q", extraParams: ["q"] });
  const page = pager.page;
  const setPage = pager.setPage;
  const query = useDebouncedValue(queryInput.trim(), 300);
  const debouncedQuery = query;

  // Sync debounced search to the URL and reset to page 1 when it changes.
  const firstSearchSync = React.useRef(true);
  React.useEffect(() => {
    if (firstSearchSync.current) {
      firstSearchSync.current = false;
      return;
    }
    pager.setFilters({ q: debouncedQuery || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const setQuery = React.useCallback((value: string) => {
    setQueryInput(value);
  }, []);

  // Queue anchor for the section rail's "Review accounts" jump.
  const queueRef = React.useRef<HTMLDivElement | null>(null);
  // One verification dock at a time — row buttons only set the target;
  // the dock is keyed by student id so switching rows re-runs the match.
  const [verifyTarget, setVerifyTarget] = React.useState<PendingStudent | null>(null);
  const handleReviewSection = React.useCallback(
    (section: string) => {
      setQuery(section);
      queueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [setQuery],
  );

  const { data, isPending, isError } = useQuery({
    queryKey: ["record-keeper-pending-students", page, debouncedQuery],
    queryFn: ({ signal }) => fetchPendingStudents(page, debouncedQuery, signal),
    placeholderData: keepPreviousData,
  });

  const { data: breakdownData, isPending: breakdownPending } = useQuery({
    queryKey: ["record-keeper-account-breakdown"],
    queryFn: (): Promise<AccountBreakdown[]> =>
      apiClient
        .get<{ data: AccountBreakdown[] }>("/api/record-keeper/account-breakdown")
        .then((res) => (Array.isArray(res.data?.data) ? res.data.data : [])),
    staleTime: 30_000,
  });

  const students = data?.students ?? [];
  const filteredTotal = data?.total ?? students.length;
  const unfilteredTotal = data?.unfilteredTotal ?? filteredTotal;

  const act = useMutation({
    mutationFn: ({
      id,
      approve,
      reason,
    }: {
      id: string;
      approve: boolean;
      reason?: string;
      name?: string;
    }) =>
      apiClient.post(
        approve ? `/api/auth/approve/${id}` : `/api/auth/reject/${id}`,
        approve ? {} : { reason: reason ?? "" }
      ),

    onMutate: async ({ id, approve, name }) => {
      // Optimistic removal with rollback on error.
      await qc.cancelQueries({ queryKey: ["record-keeper-pending-students"] });
      const previous = qc.getQueriesData({ queryKey: ["record-keeper-pending-students"] });
      qc.setQueriesData<PendingStudentsResponse>(
        { queryKey: ["record-keeper-pending-students"] },
        (old) =>
          old && Array.isArray(old.students)
            ? { ...old, students: old.students.filter((s) => s.id !== id), total: Math.max(0, (old.total ?? 1) - 1) }
            : old,
      );
      let taskId: string | null = null;
      try {
        taskId = dock.startTask({
          kind: "generic",
          title: approve ? "Approving account" : "Rejecting account",
          description: name ?? "Student",
        });
      } catch {
        taskId = null;
      }
      return { previous, taskId };
    },
    onError: (err, _vars, context) => {
      for (const [key, data] of context?.previous ?? []) {
        qc.setQueryData(key, data);
      }
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response
          ?.data?.error?.message ?? "Could not process this account. Changes were rolled back.";
      if (context?.taskId) dock.failTask(context.taskId, message);
      toast.error({ title: "Action failed", description: message });
    },
    onSuccess: (_data, { id, approve, name }, context) => {

      markSelfNotified(id);

      // The row was already removed optimistically, so the name rides along
      // in the mutation variables instead of being looked up from the cache.
      const studentName = name ?? "Student";
      if (context?.taskId) {
        dock.completeTask(context.taskId, approve ? "Account approved." : "Account rejected.");
      }
      toast.success({
        title: approve ? "Approved" : "Rejected",
        description: approve ? `${studentName} is now active.` : `${studentName} was rejected.`,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["record-keeper-pending-students"] });
      qc.invalidateQueries({ queryKey: ["record-keeper-accounts-audit"] });
      qc.invalidateQueries({ queryKey: ["record-keeper-account-breakdown"] });
      qc.invalidateQueries({ queryKey: ["record-keeper-overview"] });
      qc.invalidateQueries({ queryKey: ["record-keeper-notifications"] });
    },
  });

  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));

  const safePage = Math.min(page, totalPages);

  const actingVars = act.isPending
    ? (act.variables as { id: string; approve: boolean } | undefined)
    : undefined;
  const pageRows = React.useMemo(() => data?.students ?? [], [data]);
  const hasRecords = unfilteredTotal > 0;
  const searching = debouncedQuery.length > 0;

  const sideStats = React.useMemo(() => {
    const rows = breakdownData ?? [];
    return {
      withAccount: rows.reduce((s, r) => s + r.withAccount, 0),
      pendingSignup: rows.reduce((s, r) => s + r.pending, 0),
      sections: rows.length,
    };
  }, [breakdownData]);

  const kpisPending = breakdownPending || isPending;

  // KPI strip — kanban columns mirroring the record keeper overview stats
  // board (KanbanBoardHeader + number-first stat card with mascot chip).
  // Mascots are deliberately distinct from the other desk boards' cast
  // (overview owl/scout/knight/postbot, final-grades scientist/rocket/cap,
  // sf10 hamster/drone/lantern).
  const kpiColumns = [
    {
      key: "pending",
      icon: Clock,
      accent: "text-amber-500",
      title: "Pending approval",
      value: unfilteredTotal,
      hint: "G7–10 sign-ups awaiting sign-off",
      mascot: "clockwork",
    },
    {
      key: "with-account",
      icon: UserCheck,
      accent: "text-primary",
      title: "With account",
      value: sideStats.withAccount,
      hint: "Active student logins",
      mascot: "fox",
    },
    {
      key: "pending-signup",
      icon: UserPlus,
      accent: "text-blue-500",
      title: "Pending sign-up",
      value: sideStats.pendingSignup,
      hint: "Rostered learners with no login yet",
      mascot: "bunny",
    },
    {
      key: "sections",
      icon: Layers,
      accent: "text-emerald-600 dark:text-emerald-400",
      title: "Sections tracked",
      value: sideStats.sections,
      hint: "G7–10 sections this school year",
      mascot: "hedgehog",
    },
  ];

  // Kanban rows — status pill + `|`, mascot + name (derived sprite, same
  // derivation the backend persists), LRN rectangle pill, then section /
  // grade / requested meta pills and the icon-only LRN verification action.
  const rowItems = React.useMemo<RowListItem[]>(
    () =>
      pageRows.map((s) => ({
        key: s.id,
        status: { label: "Pending", tone: "amber" as const },
        title: s.name,
        idLabel: s.lrn,
        idLabelClassName: "text-xs font-medium",
        meta: [
          { label: formatSection(s.section), tone: "amber" as const, dot: false },
          { label: formatGrade(s.gradeLevel), tone: "amber" as const, dot: false },
          {
            label: formatRelativeTime(s.requestedAt),
            tone: "muted" as const,
            dot: false,
            title: `Requested ${new Date(s.requestedAt).toLocaleString()}`,
          },
        ],
        ariaLabel: `${s.name}, pending account, ${formatSection(s.section)}`,
        avatarMascot: { name: s.name, seed: s.lrn },
        actions: <LrnVerifyButton student={s} onOpen={() => setVerifyTarget(s)} />,
      })),
    [pageRows]
  );

  // True empty (no records at all, not a search with no matches):
  // hide the KPI board and queue/breakdown cards entirely and
  // render a single centered card instead.
  const isTrueEmpty =
    !isPending && !isError && !breakdownPending && !hasRecords && !searching;

  if (isTrueEmpty) {
    return (
      <section className={`${styles.page} ${styles.pageEmpty}`}>
        <RecordKeeperEmptyCard
          icon={UserPlus}
          title="No pending student accounts"
          hint="New G7–10 sign-ups awaiting record keeper sign-off will appear here."
          label="Account approvals"
          centered
        />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.stack}>
        <section
          className={styles.kpiBoard}
          aria-label="Accounts summary"
          aria-busy={kpisPending || undefined}
        >
          <div className={styles.kpiGrid}>
            {kpisPending
              ? Array.from({ length: kpiColumns.length }).map((_, i) => (
                  <div key={i} className={styles.kpiColumn} aria-hidden="true">
                    <div className={styles.kpiHeadSkeleton}>
                      <Skeleton className={styles.kpiSkelTitle} />
                    </div>
                    <Skeleton className={styles.kpiSkelCard} />
                  </div>
                ))
              : kpiColumns.map((column) => {
                  const Icon = column.icon;
                  return (
                    <div
                      key={column.key}
                      className={styles.kpiColumn}
                      aria-label={`${column.title}, ${column.value}`}
                    >
                      <KanbanBoardHeader
                        icon={<Icon size={14} className={column.accent} aria-hidden />}
                        title={column.title}
                      />
                      <div className={styles.kpiStat}>
                        <span className={styles.kpiStatTop}>
                          <span
                            className={`${styles.kpiNumber} ${
                              column.value === 0 ? styles.kpiNumberZero : ""
                            }`}
                          >
                            {column.value}
                          </span>
                          <span className={styles.kpiMascot} aria-hidden="true">
                            <StudentMascot
                              name={column.title}
                              character={column.mascot}
                              size={36}
                            />
                          </span>
                        </span>
                        <span className={styles.kpiHint}>{column.hint}</span>
                      </div>
                    </div>
                  );
                })}
          </div>
        </section>

        <div ref={queueRef} className={styles.queueAnchor}>
          <KanbanBoard
            title="Pending Students"
            icon={<UserPlus size={14} className="text-primary" aria-hidden />}
            description="Review student account requests for grades 7–10."
            ariaLabel="Pending student accounts"
            actions={
              <div className={styles.headerActions}>
                <div className={styles.searchWrap}>
                  <Search className={styles.searchIcon} aria-hidden />
                  <Input
                    className={styles.search}
                    placeholder="Search name, LRN, or section…"
                    value={queryInput}
                    onChange={(e) => {
                      setQuery(e.target.value);
                    }}
                    aria-label="Search pending students"
                  />
                </div>
                {queryInput && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={styles.clearBtn}
                    onClick={() => {
                      setQuery("");
                    }}
                  >
                    <X aria-hidden />
                    Clear
                  </Button>
                )}
              </div>
            }
            footer={
              <Pagination
                currentPage={safePage}
                totalItems={filteredTotal}
                onPageChange={setPage}
              />
            }
          >
            {isPending ? (
              <RowListSkeleton
                rows={8}
                gutter="0.625rem"
                withMetaAvatar={false}
                withActions
                metaPills={3}
              />
            ) : isError ? (
              <p className={styles.empty}>Could not load pending students.</p>
            ) : !hasRecords ? (
              <RecordKeeperEmptyState
                icon={UserPlus}
                title="No pending student accounts"
                hint="New G7–10 sign-ups awaiting record keeper sign-off will appear here."
              />
            ) : searching && pageRows.length === 0 ? (
              <RecordKeeperEmptyState
                icon={SearchX}
                title="No matching students"
                hint={`No students match "${query}".`}
              />
            ) : (
              <RowList
                bleed
                gutter="0.625rem"
                animateOnMount
                items={rowItems}
                emptyText="No pending student accounts."
                ariaLabel="Pending student accounts"
              />
            )}
          </KanbanBoard>
        </div>
      </div>
      <AccountsBreakdownRail
        data={breakdownData ?? []}
        loading={breakdownPending}
        onReview={handleReviewSection}
      />

      {verifyTarget ? (
        <LrnVerifyDock
          key={verifyTarget.id}
          student={verifyTarget}
          approving={actingVars?.id === verifyTarget.id}
          onClose={() => setVerifyTarget(null)}
          onApprove={() => {
            const target = verifyTarget;
            // Close at once — the shared Dock reports the request until it settles.
            setVerifyTarget(null);
            return act.mutateAsync({ id: target.id, approve: true, name: target.name }).then(() => undefined);
          }}
          onReject={(reason) => {
            const target = verifyTarget;
            setVerifyTarget(null);
            return act.mutateAsync({ id: target.id, approve: false, reason, name: target.name }).then(() => undefined);
          }}
        />
      ) : null}
    </section>
  );
}

