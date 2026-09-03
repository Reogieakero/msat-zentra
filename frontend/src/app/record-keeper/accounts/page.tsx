"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
import { AccountsHeader } from "./components/AccountsHeader";
import { LrnVerifyButton } from "./components/LrnVerifyButton";
import { AccountsBreakdown, type AccountBreakdown } from "./components/AccountsBreakdown";
import { AccountsAudit } from "./components/AccountsAudit";
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
    queryKey: ["record-keeper-pending-students"],
    queryFn: fetchPendingStudents,
  });

  const { data: breakdownData, isPending: breakdownPending } = useQuery({
    queryKey: ["record-keeper-account-breakdown"],
    queryFn: () =>
      apiClient
        .get<{ data: AccountBreakdown[] }>("/api/record-keeper/account-breakdown")
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
        approve ? {} : { reason: "Rejected by record keeper" }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["record-keeper-pending-students"] });
      qc.invalidateQueries({ queryKey: ["record-keeper-accounts-audit"] });
      qc.invalidateQueries({ queryKey: ["record-keeper-account-breakdown"] });
      setPage(1);
    },
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <section className={styles.page}>
      <AccountsHeader />

      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <CardTitle>Pending Students</CardTitle>
            <CardDescription>
              Approve or reject student account requests for grades 7–10.
            </CardDescription>
          </div>
          <CardAction className={styles.headerActions}>
            <Badge variant="warning" className={styles.countBadge}>
              {isPending ? "…" : students.length} pending
            </Badge>
            <div className={styles.searchWrap}>
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
                Clear
              </Button>
            )}
          </CardAction>
        </CardHeader>

        <CardContent className={styles.content}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <SkeletonRows />
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className={styles.empty}>
                    {students.length === 0
                      ? "No pending student accounts for grades 7–10."
                      : query.trim()
                        ? `No students match "${query}".`
                        : "No pending students found."}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((s) => (
                  <TableRow key={s.id} className={styles.row}>
                    <TableCell>
                      <div className={styles.studentCell}>
                        <span className={styles.studentName}>{s.name}</span>
                        <span className={styles.studentLrn}>{s.lrn}</span>
                      </div>
                    </TableCell>
                    <TableCell className={styles.section}>
                      {formatSection(s.section)}
                    </TableCell>
                    <TableCell className={styles.section}>{formatGrade(s.gradeLevel)}</TableCell>
                    <TableCell className={styles.section}>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={act.isPending}
                            aria-label={`Actions for ${s.name}`}
                          >
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        <CardFooter className={styles.footer}>
          <span className={styles.footerInfo}>
            {filtered.length > 0 ? `${start}–${end} of ${filtered.length}` : "0 of 0"}
          </span>
          <div className={styles.footerActions}>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 1 || filtered.length === 0}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft aria-hidden />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages || filtered.length === 0}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </CardFooter>
      </Card>

      <AccountsBreakdown data={breakdownData ?? []} loading={breakdownPending} />

      <AccountsAudit />
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