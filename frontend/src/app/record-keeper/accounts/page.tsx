"use client";

import * as React from "react";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  X,
  UserPlus,
  SearchX,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { markSelfNotified } from "@/lib/realtime/recordKeeperChannel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LrnVerifyButton } from "./components/LrnVerifyButton";
import { RecordKeeperEmptyCard, RecordKeeperEmptyState } from "../components/RecordKeeperEmptyCard";
import { RecordKeeperPageHeader } from "../components/RecordKeeperPageHeader";
import { PageHeaderSkeleton } from "@/app/principal/components/skeletons/PageHeaderSkeleton";
import { AccountsBreakdown, type AccountBreakdown } from "./components/AccountsBreakdown";
import { formatGrade, formatSection } from "@/lib/utils";
import type { PendingStudentsResponse } from "./components/types";
import { formatRelativeTime } from "./components/types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
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

  const { data, isPending, isError, isFetching } = useQuery({
    queryKey: ["record-keeper-pending-students", page, debouncedQuery],
    queryFn: ({ signal }) => fetchPendingStudents(page, debouncedQuery, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const { data: breakdownData, isPending: breakdownPending } = useQuery({
    queryKey: ["record-keeper-account-breakdown"],
    queryFn: () =>
      apiClient
        .get<{ data: AccountBreakdown[] }>("/api/record-keeper/account-breakdown")
        .then((res) => (Array.isArray(res.data?.data) ? res.data.data : [])),
    staleTime: 30_000,
  });

  const students = data?.students ?? [];
  const filteredTotal = data?.total ?? students.length;
  const unfilteredTotal = data?.unfilteredTotal ?? filteredTotal;
  const isSyncing = isFetching && !isPending;

  const act = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      apiClient.post(
        approve ? `/api/auth/approve/${id}` : `/api/auth/reject/${id}`,
        approve ? {} : { reason: "Rejected by record keeper" }
      ),
    onMutate: async ({ id }) => {
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
      return { previous };
    },
    onSuccess: (_data, { id, approve }) => {

      markSelfNotified(id);
      toast.success({
        title: approve ? "Approved" : "Rejected",
        description: approve ? "The student account is now active." : "The account request was rejected.",
      });
    },
    onError: (err, _vars, context) => {
      for (const [key, data] of context?.previous ?? []) {
        qc.setQueryData(key, data);
      }
      toast.error({ title: "Action failed", description: "Could not process this account. Changes were rolled back." });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["record-keeper-pending-students"] });
      qc.invalidateQueries({ queryKey: ["record-keeper-accounts-audit"] });
      qc.invalidateQueries({ queryKey: ["record-keeper-account-breakdown"] });
      qc.invalidateQueries({ queryKey: ["record-keeper-notifications"] });
    },
  });

  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));

  const safePage = Math.min(page, totalPages);
  const pageRows = students;
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

  const tilesPending = breakdownPending || isPending;
  // True empty (no records at all, not a search with no matches):
  // hide the page header, tiles, and queue/breakdown cards entirely and
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
        {tilesPending ? (
          <PageHeaderSkeleton />
        ) : (
          <RecordKeeperPageHeader
            title="Account Approvals"
            description="Approve or reject student account requests for grades 7–10."
          />
        )}
        <section className={assign.card} aria-label="Accounts summary">
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          {tilesPending ? (
            <ul className={`${styles.tiles} relative`}>
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className={styles.tileSkel} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className={`${styles.tiles} relative`}>
              <li className={styles.tile}>
                <span className={styles.tileValue}>{unfilteredTotal}</span>
                <span className={styles.tileLabel}>Pending approval</span>
                <span className={styles.tileHint}>G7–10 sign-ups awaiting sign-off</span>
              </li>
              <li className={styles.tile}>
                <span className={styles.tileValue}>{sideStats.withAccount}</span>
                <span className={styles.tileLabel}>With account</span>
                <span className={styles.tileHint}>Active student logins</span>
              </li>
              <li className={styles.tile}>
                <span className={styles.tileValue}>{sideStats.pendingSignup}</span>
                <span className={styles.tileLabel}>Pending sign-up</span>
                <span className={styles.tileHint}>Rostered learners with no login yet</span>
              </li>
              <li className={styles.tile}>
                <span className={styles.tileValue}>{sideStats.sections}</span>
                <span className={styles.tileLabel}>Sections tracked</span>
                <span className={styles.tileHint}>G7–10 sections this school year</span>
              </li>
            </ul>
          )}
        </section>

        <section className={assign.card} aria-labelledby="accounts-queue-heading">
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className={`${styles.queueHead} relative`}>
            <div className={styles.queueHeadText}>
              <h2 id="accounts-queue-heading" className="text-base font-semibold">
                Pending Students
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Approve or reject student account requests for grades 7–10 —{" "}
                {isPending ? "…" : `${filteredTotal} pending${isSyncing ? " · Syncing…" : ""}`}.
              </p>
            </div>
            <div className={styles.queueActions}>
              <div className={styles.qSearchWrap}>
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
                  Show all
                </Button>
              )}
            </div>
          </div>

          <div className={`${styles.content} relative`}>
            {isPending ? (
              <div className={styles.tableWrap}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Verification</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SkeletonRows />
                  </TableBody>
                </Table>
              </div>
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
              <div className={styles.tableWrap}>
                <Table aria-label="Pending student accounts">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Verification</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className={styles.studentCell}>
                            <span className={styles.studentName}>{s.name}</span>
                            <span className={styles.studentLrn}>{s.lrn}</span>
                          </div>
                        </TableCell>
                        <TableCell className={styles.cell}>
                          {formatSection(s.section)}
                        </TableCell>
                        <TableCell className={styles.cell}>{formatGrade(s.gradeLevel)}</TableCell>
                        <TableCell className={styles.cell}>
                          <span className={styles.requested}>{formatRelativeTime(s.requestedAt)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="amber" className={styles.statusBadge}>
                            Pending
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <LrnVerifyButton
                            student={s}
                            onApprove={() => act.mutateAsync({ id: s.id, approve: true }).then(() => undefined)}
                            approving={act.isPending}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <Pagination
            currentPage={safePage}
            totalItems={filteredTotal}
            onPageChange={setPage}
          />
        </section>

        <AccountsBreakdown data={breakdownData ?? []} loading={breakdownPending} />
      </div>
    </section>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className={styles.studentCell}>
              <Skeleton className={styles.skelName} />
              <Skeleton className={styles.skelLrn} />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelCell} style={{ width: "50%" }} />
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelCell} style={{ width: "38%" }} />
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelCell} style={{ width: "50%" }} />
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelCell} style={{ width: "44%" }} />
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelCell} style={{ width: "64%" }} />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
