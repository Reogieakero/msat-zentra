"use client";

import { Loader2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CoordinatorEnrolledSkeleton } from "./coordinator-enrolled-skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  admCaseStatusVariant,
  deriveAdmCaseStatus,
  eligibilityLabel,
  stageLabel,
  type AdmCaseRow,
} from "../../components/coordinator-data";
import type { HistoryTarget } from "../../components/CaseHistoryDialog";
import { historyTargetFor } from "../../components/CaseHistoryDialog";
import styles from "./coordinator-enrolled-table.module.css";

interface CoordinatorEnrolledTableProps {
  rows: AdmCaseRow[];
  stageTab: "enrollment_monitoring" | "completion";
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  hasActiveFilters: boolean;
  /** Row currently being completed — its menu item shows `Marking…`
      while every other row stays usable. */
  completingId?: string | null;
  onRetry: () => void;
  onOpenCase: (row: AdmCaseRow) => void;
  onHistory: (target: HistoryTarget) => void;
  onComplete: (row: AdmCaseRow) => void;
}

export function CoordinatorEnrolledTable({
  rows,
  stageTab,
  isPending,
  isError,
  isRefetching,
  hasActiveFilters,
  completingId = null,
  onRetry,
  onOpenCase,
  onHistory,
  onComplete,
}: CoordinatorEnrolledTableProps) {
  if (isPending) {
    return <CoordinatorEnrolledSkeleton rows={10} />;
  }

  if (isError) {
    return (
      <div className={styles.errorBlock} role="alert">
        <p className={styles.errorText}>
          We couldn&apos;t load the enrolled students. Please check your
          internet connection and try again.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={isRefetching}
          onClick={onRetry}
        >
          {isRefetching ? (
            <Loader2 className={styles.spin} aria-hidden="true" />
          ) : null}
          {isRefetching ? "Loading…" : "Try again"}
        </Button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={styles.emptyWrap}>
        <p className={styles.emptyText}>
          {hasActiveFilters
            ? `No enrolled students match your search and filters.`
            : stageTab === "enrollment_monitoring"
              ? `No students in enrollment monitoring yet. Approved cases appear here automatically.`
              : `No completed ADM cases yet.`}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <Table
        className={`${styles.table} ${styles.alertTable}`}
        aria-label="Enrolled ADM students"
      >
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Case status</TableHead>
            <TableHead>Eligibility</TableHead>
            <TableHead>Approved</TableHead>
            <TableHead>Date approved</TableHead>
            <TableHead>
              <span className="sr-only">Row actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const caseStatus = deriveAdmCaseStatus(
              r.stage,
              r.eligibilityStatus,
              r.approvedBy,
            );
            return (
              <TableRow key={r.id}>
                <TableCell>
                  <p className={styles.cellMain}>{r.student}</p>
                  <div className={`${styles.studentSub} ${styles.mono}`}>
                    {r.lrn}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">ADM</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={admCaseStatusVariant(caseStatus.key)}
                    title={stageLabel(r.stage)}
                  >
                    {caseStatus.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      r.eligibilityStatus === "eligible"
                        ? "secondary"
                        : r.eligibilityStatus === "ineligible"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {eligibilityLabel(r.eligibilityStatus)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <p className={styles.cellMain}>{r.approvedBy ?? "—"}</p>
                </TableCell>
                <TableCell>
                  <p className={styles.cellMain}>
                    {r.approvalDate ? r.approvalDate.slice(0, 10) : "—"}
                  </p>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Actions for ${r.student}`}
                      >
                        <MoreHorizontal aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onOpenCase(r)}>
                        Open case
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => onHistory(historyTargetFor(r))}
                      >
                        See history
                      </DropdownMenuItem>
                      {r.stage === "enrollment_monitoring" ? (
                        <DropdownMenuItem
                          disabled={completingId === r.id}
                          onSelect={() => onComplete(r)}
                        >
                          {completingId === r.id ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.375rem",
                              }}
                            >
                              <Loader2
                                className={styles.spin}
                                aria-hidden="true"
                              />
                              Marking…
                            </span>
                          ) : (
                            "Mark as completed"
                          )}
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
