"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  MoreHorizontal,
  Check,
  X,
  UserPlus,
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
import { SLIDES } from "./components/AccountsHeader";
import { LrnVerifyButton } from "./components/LrnVerifyButton";
import { AccountsBreakdown, type AccountBreakdown } from "./components/AccountsBreakdown";
import { formatGrade, formatSection } from "@/lib/utils";
import type { PendingStudent, PendingStudentsResponse } from "./components/types";
import { formatRelativeTime } from "./components/types";
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

  const { data, isPending } = useQuery({
    queryKey: ["pending-students"],
    queryFn: fetchPendingStudents,
  });

  const { data: breakdownData, isPending: breakdownPending } = useQuery({
    queryKey: ["account-breakdown"],
    queryFn: () =>
      apiClient
        .get<{ data: AccountBreakdown[] }>("/api/registrar/account-breakdown")
        .then((res) => res.data.data),
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
        approve ? {} : { reason: "Rejected by registrar" }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-students"] });
      qc.invalidateQueries({ queryKey: ["accounts-audit"] });
      qc.invalidateQueries({ queryKey: ["account-breakdown"] });
      setPage(1);
    },
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);

  const sideStats = React.useMemo(() => {
    const rows = breakdownData ?? [];
    return {
      withAccount: rows.reduce((s, r) => s + r.withAccount, 0),
      pendingSignup: rows.reduce((s, r) => s + r.pending, 0),
      sections: rows.length,
    };
  }, [breakdownData]);

  return (
    <section className={styles.page}>
      <div className={styles.body}>
        <aside className={styles.sidebar} aria-label="Accounts summary">
          <div className={styles.sideCard}>
            <h2 className={styles.sideTitle}>Accounts</h2>
            <p className={styles.sideDesc}>
              G11–12 sign-ups and section coverage.
            </p>
            <ul className={styles.sideList}>
              <li className={styles.sideRow}>
                <span className={styles.sideLabel}>Pending approval</span>
                <span className={styles.sideValue}>
                  {isPending ? "…" : students.length}
                </span>
              </li>
              <li className={styles.sideRow}>
                <span className={styles.sideLabel}>With account</span>
                <span className={styles.sideValue}>
                  {breakdownPending ? "…" : sideStats.withAccount}
                </span>
              </li>
              <li className={styles.sideRow}>
                <span className={styles.sideLabel}>Pending sign-up</span>
                <span className={styles.sideValue}>
                  {breakdownPending ? "…" : sideStats.pendingSignup}
                </span>
              </li>
              <li className={styles.sideRow}>
                <span className={styles.sideLabel}>Sections tracked</span>
                <span className={styles.sideValue}>
                  {breakdownPending ? "…" : sideStats.sections}
                </span>
              </li>
            </ul>
          </div>

          {SLIDES.map((slide) => (
            <article key={slide.title} className={styles.guideCard}>
              <div className={styles.guideHead}>
                <slide.icon className={styles.guideIcon} aria-hidden />
                <h3 className={styles.guideTitle}>{slide.title}</h3>
              </div>
              <p className={styles.guideBody}>{slide.body}</p>
            </article>
          ))}
        </aside>

        <div className={styles.main}>
          <section aria-label="Pending student accounts">
        <div className={styles.queueHead}>
          <div className={styles.queueHeadText}>
            <h2 className={styles.queueTitle}>Pending Students</h2>
            <p className={styles.queueDesc}>
              Approve or reject student account requests for grades 11–12 —{" "}
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
        ) : filtered.length === 0 ? (
          <div className={styles.emptyPanel}>
            <span className={styles.emptyIcon} aria-hidden>
              <UserPlus />
            </span>
            <p className={styles.emptyTitle}>
              {students.length === 0
                ? "No pending student accounts"
                : query.trim()
                  ? "No matching students"
                  : "No pending students found"}
            </p>
            <p className={styles.emptyHint}>
              {students.length === 0
                ? "New G11–12 sign-ups awaiting registrar sign-off will appear here."
                : query.trim()
                  ? `No students match "${query}".`
                  : "All caught up — nothing needs approval right now."}
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
                  <TableRow key={s.id} className={styles.row}>
                    <TableCell>
                      <p className={styles.cellMain}>{s.name}</p>
                      <p className={styles.cellSub}>
                        <span className={styles.lrn}>{s.lrn}</span>
                      </p>
                    </TableCell>
                    <TableCell className={styles.cell}>
                      {formatSection(s.section)}
                    </TableCell>
                    <TableCell className={styles.cell}>{formatGrade(s.gradeLevel)}</TableCell>
                    <TableCell className={styles.cell}>
                      <span className={styles.requested}>{formatRelativeTime(s.requestedAt)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="warning" className={styles.statusBadge}>
                        Pending
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <LrnVerifyButton
                        student={s}
                        onApprove={() => act.mutate({ id: s.id, approve: true })}
                        approving={act.isPending}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" disabled={act.isPending}>
                            <MoreHorizontal aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => act.mutate({ id: s.id, approve: true })}>
                            <Check aria-hidden />
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => act.mutate({ id: s.id, approve: false })}>
                            <X aria-hidden />
                            Reject
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

        <div className={styles.pager}>
          <p className={styles.range}>
            Showing {filtered.length > 0 ? `${start}–${end}` : "0"} of {filtered.length}
          </p>
          <div className={styles.pagerButtons}>
            <Button
              size="xs"
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
              size="xs"
              variant="outline"
              disabled={safePage >= totalPages || filtered.length === 0}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      <AccountsBreakdown data={breakdownData ?? []} loading={breakdownPending} />
        </div>
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
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}
