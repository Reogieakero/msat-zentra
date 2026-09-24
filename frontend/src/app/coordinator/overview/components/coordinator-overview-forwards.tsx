"use client";

import Link from "next/link";
import { Loader2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  admCaseStatusVariant,
  consultReviewerLabel,
  deriveAdmCaseStatus,
  formatElapsedShort,
  msSinceDate,
  type AdmCaseRow,
} from "../../components/coordinator-data";
import type { HistoryTarget } from "../../components/CaseHistoryDialog";
import { historyTargetFor } from "../../components/CaseHistoryDialog";
import styles from "./coordinator-overview-forwards.module.css";

interface CoordinatorOverviewForwardsProps {
  rows: AdmCaseRow[];
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  now: number;
  onRetry: () => void;
  onHistory: (target: HistoryTarget) => void;
}

export function CoordinatorOverviewForwards({
  rows,
  isPending,
  isError,
  isRefetching,
  now,
  onRetry,
  onHistory,
}: CoordinatorOverviewForwardsProps) {
  return (
    <div className={styles.card}>
      <div className={styles.panelHead}>
        <div>
          <h2 className={styles.sectionTitle}>
            Recent forwards from Nurse / Guidance
          </h2>
          <p className={styles.sectionDesc}>
            The freshest consultation hand-offs waiting for your learner profile.
          </p>
        </div>
        <Link className={styles.kpiBtnSolid} href="/coordinator/referrals">
          See all
        </Link>
      </div>
      <div className={styles.panelBody}>
        {isPending ? (
          <div className={styles.tableWrap} aria-busy="true">
            <table
              className={`${styles.table} ${styles.alertTable}`}
              aria-hidden="true"
            >
              <tbody>
                {[0, 1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td colSpan={6}>
                      <Skeleton style={{ width: "100%", height: "2rem" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : isError ? (
          <div className={styles.errorBlock} role="alert">
            <p className={styles.errorText}>
              We couldn&apos;t load the latest forwards — your KPIs above are
              still current.
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
        ) : rows.length === 0 ? (
          <p className={styles.emptyText}>
            No pending forwards — intake is clear.
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <Table
              className={`${styles.table} ${styles.alertTable}`}
              aria-label="Recent ADM forwards"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Forwarded by</TableHead>
                  <TableHead>Case status</TableHead>
                  <TableHead>Time elapsed</TableHead>
                  <TableHead>Date referred</TableHead>
                  <TableHead>
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  // Elapsed runs from the guidance/nurse hand-off, falling
                  // back to the observation date only for legacy rows.
                  const elapsed = msSinceDate(r.endorsedAt ?? r.datePrepared, now);
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
                        <p className={styles.cellMain}>
                          {consultReviewerLabel(r.consultReviewer)}:
                        </p>
                        <div className={styles.studentSub}>
                          Adviser: {r.preparedBy}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={admCaseStatusVariant(caseStatus.key)}>
                          {caseStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className={styles.cellTime} aria-live="off">
                          {elapsed === null
                            ? "—"
                            : `${formatElapsedShort(elapsed)} ago`}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className={styles.cellMain}>
                          {r.endorsedAt
                            ? r.endorsedAt.slice(0, 10)
                            : (r.datePrepared ?? "—")}
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
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/coordinator/referrals?highlight=${encodeURIComponent(r.id)}`}
                              >
                                Open case
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => onHistory(historyTargetFor(r))}
                            >
                              See history
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
