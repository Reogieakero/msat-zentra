"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import {
  Search,
  MoreHorizontal,
  Check,
  X,
  UserPlus,
  SearchX,
  Loader2,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { LrnVerifyButton } from "./components/LrnVerifyButton";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { markSelfNotified } from "@/lib/realtime/registrarChannel";
import { AccountsBreakdown, type AccountBreakdown } from "./components/AccountsBreakdown";
import { formatGrade, formatSection } from "@/lib/utils";
import type { PendingStudentsResponse } from "./components/types";
import { formatRelativeTime } from "./components/types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./accounts.module.css";

const PAGE_SIZE = 15;

async function fetchPendingStudents(page: number, q: string, signal?: AbortSignal) {
  return apiClient
    .get<PendingStudentsResponse>("/api/auth/pending", {
      params: { role: "student", page, pageSize: PAGE_SIZE, ...(q ? { q } : {}) },
      signal,
    })
    .then((res) => res.data);
}

export default function AccountApprovalsPage() {
  const qc = useQueryClient();
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);

  const { data, isPending, isError } = useQuery({
    queryKey: ["pending-students", page, debouncedQuery],
    queryFn: ({ signal }) => fetchPendingStudents(page, debouncedQuery, signal),
    placeholderData: keepPreviousData,
  });

  const { data: breakdownData, isPending: breakdownPending } = useQuery({
    queryKey: ["account-breakdown"],
    queryFn: (): Promise<AccountBreakdown[]> =>
      apiClient
        .get<{ data: AccountBreakdown[] }>("/api/registrar/account-breakdown")

        .then((res) => (Array.isArray(res.data?.data) ? res.data.data : [])),
    staleTime: 30_000,
  });

  const students = data?.students ?? [];
  const filteredTotal = data?.total ?? students.length;
  const unfilteredTotal = data?.unfilteredTotal ?? filteredTotal;

  const act = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      apiClient.post(
        approve ? `/api/auth/approve/${id}` : `/api/auth/reject/${id}`,
        approve ? {} : { reason: "Rejected by registrar" }
      ),

    onError: (err) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response
          ?.data?.error?.message ?? "Could not process this account.";
      toast.error({ title: "Action failed", description: message });
    },
    onSuccess: (_data, { id, approve }) => {

      markSelfNotified(id);

      const name =
        qc
          .getQueriesData<PendingStudentsResponse>({ queryKey: ["pending-students"] })
          .flatMap(([, d]) => d?.students ?? [])
          .find((s) => s.id === id)?.name ?? "Student";
      toast.success({
        title: approve ? "Approved" : "Rejected",
        description: approve ? `${name} is now active.` : `${name} was rejected.`,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["pending-students"] });
      qc.invalidateQueries({ queryKey: ["accounts-audit"] });
      qc.invalidateQueries({ queryKey: ["account-breakdown"] });
      qc.invalidateQueries({ queryKey: ["registrar-overview"] });
      qc.invalidateQueries({ queryKey: ["registrar-notifications"] });
    },
  });

  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));

  const safePage = Math.min(page, totalPages);

  const actingVars = act.isPending
    ? (act.variables as { id: string; approve: boolean } | undefined)
    : undefined;
  const pageRows = students;
  const start = filteredTotal === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filteredTotal);
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

  return (
    <section className={styles.page}>
      <div className={styles.stack}>
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
                <span className={styles.tileHint}>G11–12 sign-ups awaiting sign-off</span>
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
                <span className={styles.tileHint}>G11–12 sections this school year</span>
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
                Approve or reject student account requests for grades 11–12 —{" "}
                {isPending ? "…" : `${unfilteredTotal} pending`}.
              </p>
            </div>
            <div className={styles.queueActions}>
              <div className={styles.qSearchWrap}>
                <Search className={styles.searchIcon} aria-hidden />
                <Input
                  className={styles.search}
                  placeholder="Search name, LRN, or section…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Search pending students"
                />
              </div>
              {query && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.clearBtn}
                  onClick={() => {
                    setQuery("");
                    setPage(1);
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
                      <TableHead>
                        <span className={styles.srOnly}>Row actions</span>
                      </TableHead>
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
              <div className={styles.emptyBlock}>
                <span className={styles.emptyIcon} aria-hidden>
                  <UserPlus />
                </span>
                <p className={styles.emptyTitle}>No pending student accounts</p>
                <p className={styles.emptyHint}>
                  New G11–12 sign-ups awaiting registrar sign-off will appear here.
                </p>
              </div>
            ) : searching && pageRows.length === 0 ? (
              <div className={styles.emptyBlock}>
                <span className={styles.emptyIcon} aria-hidden>
                  <SearchX />
                </span>
                <p className={styles.emptyTitle}>No matching students</p>
                <p className={styles.emptyHint}>
                  {`No students match "${query}".`}
                </p>
              </div>
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
                      <TableHead>
                        <span className={styles.srOnly}>Row actions</span>
                      </TableHead>
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
                        <TableCell className={styles.menuCell}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8" disabled={actingVars?.id === s.id} aria-label={`Actions for ${s.name}`}>
                                {actingVars?.id === s.id ? (
                                  <Loader2 className="animate-spin" aria-hidden />
                                ) : (
                                  <MoreHorizontal aria-hidden />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={actingVars?.id === s.id}
                                onSelect={() => act.mutate({ id: s.id, approve: true })}
                              >
                                {actingVars?.id === s.id && actingVars.approve ? (
                                  <Loader2 className="animate-spin" aria-hidden />
                                ) : (
                                  <Check aria-hidden />
                                )}
                                {actingVars?.id === s.id && actingVars.approve ? "Approving…" : "Approve"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={actingVars?.id === s.id}
                                onSelect={() => act.mutate({ id: s.id, approve: false })}
                              >
                                {actingVars?.id === s.id && !actingVars.approve ? (
                                  <Loader2 className="animate-spin" aria-hidden />
                                ) : (
                                  <X aria-hidden />
                                )}
                                {actingVars?.id === s.id && !actingVars.approve ? "Rejecting…" : "Reject"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {hasRecords && (
            <div className={`${styles.pager} relative`}>
              <p className={styles.range}>
                Showing {filteredTotal > 0 ? `${start}–${end}` : "0"} of {filteredTotal}
              </p>
              <div className={styles.pagerButtons}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safePage <= 1 || filteredTotal === 0}
                  onClick={() => setPage(Math.max(1, safePage - 1))}
                >
                  Previous
                </Button>
                <span className={styles.pageLabel} aria-live="polite">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safePage >= totalPages || filteredTotal === 0}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </section>

        <AccountsBreakdown data={breakdownData ?? []} loading={breakdownPending} />
      </div>
    </section>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 15 }).map((_, i) => (
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
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}
