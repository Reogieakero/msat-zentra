"use client";

import * as React from "react";
import Link from "next/link";
import { History, Loader2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  friendlyActionType,
  latestActionFallback,
} from "@/services/coordinator/labels";
import { formatElapsedShort, msSinceDate } from "@/lib/clock";
import type { AdmCaseRow } from "@/services/coordinator/coordinator.types";
import type { HistoryTarget } from "../../components/CaseHistoryDialog";
import { historyTargetFor } from "../../components/CaseHistoryDialog";
import { CoordinatorEmptyState } from "../../components/CoordinatorEmptyCard";
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

const PAGE_SIZE = 15;

function buildInterpretation(rows: AdmCaseRow[], now: number): string {
  if (rows.length === 0) {
    return "No consultation hand-offs are waiting — intake is clear.";
  }
  const elapsedList = rows
    .map((r) => msSinceDate(r.endorsedAt ?? r.datePrepared, now))
    .filter((v): v is number => v !== null);
  const oldest =
    elapsedList.length > 0 ? formatElapsedShort(Math.max(...elapsedList)) : null;
  const nurse = rows.filter((r) => r.consultReviewer === "nurse").length;
  const guidance = rows.length - nurse;
  const mix =
    nurse > 0 && guidance > 0
      ? ` (${nurse} from the Nurse, ${guidance} from Guidance)`
      : nurse > 0
        ? " (all from the Nurse)"
        : " (all from Guidance)";
  return (
    `${rows.length} pending forward${rows.length === 1 ? "" : "s"} waiting for a learner profile${mix}.` +
    (oldest ? ` Longest waiting ${oldest} ago.` : "")
  );
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

  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);
  const end = Math.min(start + PAGE_SIZE, rows.length);
  const isEmpty = !isPending && !isError && rows.length === 0;
  return (
    <Card className={styles.card}>
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      {!isEmpty && (
        <CardHeader>
          <div className={styles.headerRow}>
            <div>
              <CardTitle className={styles.sectionTitle}>
                Recent forwards from Nurse / Guidance
              </CardTitle>
              <CardDescription className={styles.sectionDesc}>
                The freshest consultation hand-offs waiting for your learner profile.
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/coordinator/referrals">See all</Link>
            </Button>
          </div>
        </CardHeader>
      )}
      <CardContent className={styles.body}>
        {isPending ? (
          <div className={styles.tableWrap} aria-busy="true">
            <table className={styles.skelTable} aria-hidden="true">
              <tbody>
                {[0, 1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td>
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
          <CoordinatorEmptyState
            icon={History}
            title="No pending forwards"
            hint="New consultation hand-offs will appear here once filed."
          />
        ) : (
          <>
            <div className={styles.tableWrap}>
              <Table aria-label="Recent ADM forwards">
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Forwarded by</TableHead>
                    <TableHead>Case status</TableHead>
                    <TableHead>Time elapsed</TableHead>
                    <TableHead>Date referred</TableHead>
                    <TableHead>Latest action</TableHead>
                    <TableHead>
                      <span className={styles.srOnly}>Row actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((r) => {

                  const elapsed = msSinceDate(r.endorsedAt ?? r.datePrepared, now);
                   const caseStatus = deriveAdmCaseStatus(
                     r.stage,
                     r.eligibilityStatus,
                     r.approvedBy,
                     r.referralStatus,
                   );
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <p className={styles.cellMain}>{r.student}</p>
                        <p className={`${styles.cellSub} ${styles.mono}`}>
                          {r.lrn}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className={styles.cellMain}>
                          {consultReviewerLabel(r.consultReviewer)}:
                        </p>
                        <p className={styles.cellSub}>
                          Adviser: {r.preparedBy}
                        </p>
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
                        {r.lastActionType ? (
                          <>
                            <p className={styles.cellMain}>
                              {friendlyActionType(r.lastActionType)}
                            </p>
                            <p className={styles.cellSub} aria-live="off">
                              {(() => {
                                const ms = r.lastActionAt ? msSinceDate(r.lastActionAt, now) : null;
                                return ms === null ? "—" : `${formatElapsedShort(ms)} ago`;
                              })()}
                            </p>
                          </>
                        ) : (
                          (() => {

                            const fb = latestActionFallback(r);
                            if (!fb) return <p className={styles.cellMain}>—</p>;
                            const ms = msSinceDate(fb.at, now);
                            return (
                              <>
                                <p className={styles.cellMain}>{fb.label}</p>
                                <p className={styles.cellSub} aria-live="off">
                                  {ms === null ? "—" : `${formatElapsedShort(ms)} ago`}
                                </p>
                              </>
                            );
                          })()
                        )}
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
                              Track case
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
            {rows.length > PAGE_SIZE ? (
              <div className={styles.pager}>
                <p className={styles.range}>
                  Showing {start + 1}–{end} of {rows.length}
                </p>
                <div className={styles.pagerButtons}>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={safePage <= 1}
                    onClick={() => setPage(safePage - 1)}
                  >
                    Previous
                  </Button>
                  <span className={styles.pageLabel} aria-live="polite">
                    Page {safePage} of {totalPages}
                  </span>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage(safePage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
        {!isPending && !isError && !isEmpty ? (
          <p className={styles.interpretation}>
            <span className={styles.interpretationLabel}>What it means · </span>
            {buildInterpretation(rows, now)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
