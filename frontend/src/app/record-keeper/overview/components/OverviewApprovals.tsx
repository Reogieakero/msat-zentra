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
import { RecordKeeperEmptyState } from "../../components/RecordKeeperEmptyCard";
import type { PendingStudentsResponse } from "../../accounts/components/types";
import { formatRelativeTime } from "../../accounts/components/types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "@/components/registry/overview/OverviewApprovals.module.css";
import { PAGE_SIZE } from "@/components/shared/pagination";

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

  const pendingStudents = data?.students ?? [];
  const total = data?.total ?? pendingStudents.length;
  const pageRows = pendingStudents;
  const start = total === 0 ? 0 : 1;
  const end = Math.min(PAGE_SIZE, total);
  const hasRecords = total > 0;
  const isEmpty = !isPending && !isError && !hasRecords;

  const act = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      apiClient.post(
        approve ? `/api/auth/approve/${id}` : `/api/auth/reject/${id}`,
        approve ? {} : { reason: "Rejected by record keeper" }
      ),
    onSuccess: (_data, { id, approve }) => {

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
    <section className={assign.card} aria-labelledby={isEmpty ? undefined : "overview-pending-approvals"}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      {!isEmpty && (
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
      )}
      <div className={`${styles.content} relative`}>
        {isPending ? (
          <div className={styles.tableWrap}>
            <Skeleton className={styles.tableSkel} />
          </div>
        ) : isError ? (
          <p className={styles.empty}>Could not load overview figures.</p>
        ) : !hasRecords ? (
          <RecordKeeperEmptyState
            icon={UserCheck}
            title="All caught up"
            hint="No pending student enrollments in the G7–10 band."
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
