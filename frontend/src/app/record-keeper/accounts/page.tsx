"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  X,
  UserPlus,
  SearchX,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/recordKeeperChannel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LrnVerifyButton } from "./components/LrnVerifyButton";
import { AccountsBreakdown, type AccountBreakdown } from "./components/AccountsBreakdown";
import { formatGrade, formatSection } from "@/lib/utils";
import type { PendingStudentsResponse } from "./components/types";
import { formatRelativeTime } from "./components/types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./accounts.module.css";

const PAGE_SIZE = 8;

async function fetchPendingStudents() {
  return apiClient
    .get<PendingStudentsResponse>("/api/auth/pending", { params: { role: "student" } })
    .then((res) => res.data);
}

export default function AccountApprovalsPage() {
  const qc = useQueryClient();
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const { data, isPending, isError } = useQuery({
    queryKey: ["record-keeper-pending-students"],
    queryFn: fetchPendingStudents,
  });

  const { data: breakdownData, isPending: breakdownPending } = useQuery({
    queryKey: ["record-keeper-account-breakdown"],
    queryFn: () =>
      apiClient
        .get<{ data: AccountBreakdown[] }>("/api/record-keeper/account-breakdown")
        .then((res) => (Array.isArray(res.data?.data) ? res.data.data : [])),
    enabled: true,
  });

  const students = data?.students ?? [];

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.lrn.toLowerCase().includes(q) ||
        s.section.toLowerCase().includes(q)
    );
  }, [students, query]);

  const act = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      apiClient.post(
        approve ? `/api/auth/approve/${id}` : `/api/auth/reject/${id}`,
        approve ? {} : { reason: "Rejected by record keeper" }
      ),
    onSuccess: (_data, { id, approve }) => {
      // Self-receipt lands in our own bell (badge bumps live); suppress its
      // echo toast — the toast below already confirmed the action.
      markSelfNotified(id);
      toast.success({
        title: approve ? "Approved" : "Rejected",
        description: approve ? "The student account is now active." : "The account request was rejected.",
      });
    },
    onError: () => {
      toast.error({ title: "Action failed", description: "Could not process this account." });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["record-keeper-pending-students"] });
      qc.invalidateQueries({ queryKey: ["record-keeper-accounts-audit"] });
      qc.invalidateQueries({ queryKey: ["record-keeper-account-breakdown"] });
      qc.invalidateQueries({ queryKey: ["record-keeper-notifications"] });
      setPage(1);
    },
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);
  const hasRecords = students.length > 0;
  const searching = query.trim().length > 0;

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
                <span className={styles.tileValue}>{students.length}</span>
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
                {isPending ? "…" : `${students.length} pending`}.
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
                  New G7–10 sign-ups awaiting record keeper sign-off will appear here.
                </p>
              </div>
            ) : searching && filtered.length === 0 ? (
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

          {hasRecords && (
            <div className={`${styles.pager} relative`}>
              <p className={styles.range}>
                Showing {filtered.length > 0 ? `${start}–${end}` : "0"} of {filtered.length}
              </p>
              <div className={styles.pagerButtons}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safePage <= 1 || filtered.length === 0}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className={styles.pageLabel} aria-live="polite">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safePage >= totalPages || filtered.length === 0}
                  onClick={() => setPage((p) => p + 1)}
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
      {Array.from({ length: 6 }).map((_, i) => (
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
