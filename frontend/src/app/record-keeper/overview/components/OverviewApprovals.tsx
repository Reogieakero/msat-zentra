"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/recordKeeperChannel";
import { formatGrade, formatSection } from "@/lib/utils";
import { LrnVerifyButton } from "../../accounts/components/LrnVerifyButton";
import type { PendingStudentsResponse } from "../../accounts/components/types";
import { formatRelativeTime } from "../../accounts/components/types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./OverviewApprovals.module.css";

// Same pending-students source as the Accounts page: identical column set
// and backend order (no client re-sort), same verify-and-approve action.
// Preview fetches only the first page (dedicated preview key so it never
// poisons the paged list cache); page turns live on the Accounts page.
const PAGE_SIZE = 8;

async function fetchPendingStudents(signal?: AbortSignal) {
  return apiClient
    .get<PendingStudentsResponse>("/api/auth/pending", {
      params: { role: "student", page: 1, pageSize: PAGE_SIZE },
      signal,
    })
    .then((res) => res.data);
}

export function OverviewApprovals() {
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isPending, isError } = useQuery({
    queryKey: ["record-keeper-pending-students", "preview"],
    queryFn: ({ signal }) => fetchPendingStudents(signal),
    staleTime: 30_000,
  });

  const goAccounts = React.useCallback(() => {
    router.push("/record-keeper/accounts");
  }, [router]);

  // Backend order (requested oldest-first) — exactly as the Accounts page
  // renders it. No client re-sort so the two tables stay identical.
  // Preview shows the first page only; full paging lives on Accounts.
  const pendingStudents = data?.students ?? [];
  const total = data?.total ?? pendingStudents.length;
  const pageRows = pendingStudents;
  const start = total === 0 ? 0 : 1;
  const end = Math.min(PAGE_SIZE, total);
  const hasRecords = total > 0;

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
      qc.invalidateQueries({ queryKey: ["record-keeper-overview"] });
      qc.invalidateQueries({ queryKey: ["record-keeper-notifications"] });
    },
  });

  return (
    <section className={assign.card} aria-labelledby="overview-pending-approvals">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className={`${styles.header} relative`}>
        <div className={styles.headerText}>
          <h2 id="overview-pending-approvals" className="text-base font-semibold">
            Pending Approvals
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approvals and follow-ups that need record keeper attention this term.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="link" size="sm" className={styles.viewAll} onClick={goAccounts}>
            View all
          </Button>
        </div>
      </div>
      <div className={`${styles.content} relative`}>
        {isPending ? (
          <div className={styles.tableWrap}>
            <Skeleton className={styles.tableSkel} />
          </div>
        ) : isError ? (
          <p className={styles.empty}>Could not load overview figures.</p>
        ) : !hasRecords ? (
          <div className={styles.emptyBlock}>
            <span className={styles.emptyIcon} aria-hidden>
              <UserCheck />
            </span>
            <p className={styles.emptyTitle}>All caught up</p>
            <p className={styles.emptyHint}>
              No pending student enrollments in the G7–10 band.
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
                    <TableRow key={s.id} className={styles.clickableRow} onClick={goAccounts}>
                      <TableCell>
                        <div className={styles.studentCell}>
                          <span className={styles.studentName}>{s.name}</span>
                          <span className={styles.studentLrn}>{s.lrn}</span>
                        </div>
                      </TableCell>
                      <TableCell className={styles.parentCell}>
                        {formatSection(s.section)}
                      </TableCell>
                      <TableCell className={styles.parentCell}>{formatGrade(s.gradeLevel)}</TableCell>
                      <TableCell className={styles.parentCell}>
                        {formatRelativeTime(s.requestedAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="amber" className={styles.statusBadge}>
                          Pending
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
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
        <div className={`${styles.footer} relative`}>
          <span className={styles.footerInfo}>
            {total > 0 ? `Showing ${start}–${end} of ${total}` : "0 of 0"} —{" "}
            <button type="button" className={styles.viewAll} onClick={goAccounts}>
              View all
            </button>
          </span>
        </div>
      )}
    </section>
  );
}
