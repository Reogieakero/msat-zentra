"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarPlus,
  Clock,
  History,
  Loader2,
  MoreHorizontal,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { isBookableRow } from "../../referrals/components/coordinator-referrals-interpretation";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import styles from "./coordinator-overview-forwards.module.css";

interface CoordinatorOverviewForwardsProps {
  rows: AdmCaseRow[];
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  now: number;
  bookPendingId: string | null;
  onRetry: () => void;
  onHistory: (target: HistoryTarget) => void;
  onBook: (row: AdmCaseRow) => void;
}

// Forwarding-desk mascots — the reviewer that handed the case off wears a
// fixed sprite so the board reads at a glance (nurse → the nurse sprite,
// guidance → owl, LRPC → scout); anything else falls back to the generic
// postbot. The adviser keeps a deterministic sprite seeded off their name.
const REVIEWER_MASCOT: Record<string, string> = {
  nurse: "nurse",
  guidance_counselor: "owl",
  lrpc: "scout",
};

function reviewerMascot(value: string | null | undefined): string {
  return value ? REVIEWER_MASCOT[value] ?? "postbot" : "postbot";
}

function Num({ children }: { children: React.ReactNode }) {
  return <span className={styles.interpretNum}>{children}</span>;
}

function buildInterpretation(rows: AdmCaseRow[], now: number): React.ReactNode {
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
    nurse > 0 && guidance > 0 ? (
      <>
        {" "}
        (<Num>{nurse}</Num> from the Nurse, <Num>{guidance}</Num> from Guidance)
      </>
    ) : nurse > 0 ? (
      " (all from the Nurse)"
    ) : (
      " (all from Guidance)"
    );
  return (
    <>
      <Num>{rows.length}</Num> pending forward{rows.length === 1 ? "" : "s"}{" "}
      waiting for a learner profile{mix}.
      {oldest ? (
        <>
          {" "}
          Longest waiting <Num>{oldest}</Num> ago.
        </>
      ) : null}
    </>
  );
}

/**
 * Recent forwards board — a kanban board shell (icon + title + count +
 * description) over a grid of case cards instead of a data table. Each card
 * shows the three people in the hand-off: the learner (own sprite), the desk
 * that forwarded the case (nurse / guidance sprite), and the adviser who
 * prepared it (name-seeded sprite), plus status, elapsed time and latest action.
 */
export function CoordinatorOverviewForwards({
  rows,
  isPending,
  isError,
  isRefetching,
  now,
  bookPendingId,
  onRetry,
  onHistory,
  onBook,
}: CoordinatorOverviewForwardsProps) {
  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);
  const isEmpty = !isPending && !isError && rows.length === 0;

  return (
    <KanbanBoard
      title="Recent forwards from Nurse / Guidance"
      icon={
        <span className="text-primary" aria-hidden>
          <Share2 size={14} />
        </span>
      }
      count={isPending || isError ? undefined : rows.length}
      description="The freshest consultation hand-offs waiting for your learner profile."
      ariaLabel="Recent ADM forwards"
      actions={
        <Button asChild size="sm" variant="outline">
          <Link href="/coordinator/referrals">See all</Link>
        </Button>
      }
      footer={
        !isPending && !isError && !isEmpty ? (
          <p className={styles.interpretation}>
            <span className={styles.interpretationLabel}>What it means · </span>
            {buildInterpretation(rows, now)}
          </p>
        ) : null
      }
    >
      {isPending ? (
        <div className={styles.caseGrid} aria-busy="true" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={styles.skelCard}>
              <div className={styles.skelHead}>
                <Skeleton className={styles.skelAvatar} />
                <div className={styles.skelId}>
                  <Skeleton className={styles.skelLine} />
                  <Skeleton className={styles.skelLineSm} />
                </div>
              </div>
              <Skeleton className={styles.skelPill} />
              <Skeleton className={styles.skelBlock} />
            </div>
          ))}
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
          <ul className={styles.caseGrid} aria-label="Recent ADM forwards">
            {pageRows.map((r) => {
              const elapsed = msSinceDate(r.endorsedAt ?? r.datePrepared, now);
              const caseStatus = deriveAdmCaseStatus(
                r.stage,
                r.eligibilityStatus,
                r.approvedBy,
                r.referralStatus,
              );
              const reviewer = consultReviewerLabel(r.consultReviewer);
              const bookingThis = bookPendingId === r.id;
              const bookable = isBookableRow(r);
              const closedRow =
                r.referralStatus === "dismissed" ||
                r.referralStatus === "resolved";
              return (
                <li key={r.id} className={styles.caseCard}>
                  <div className={styles.caseHead}>
                    <StudentMascot name={r.student} seed={r.lrn} size={36} />
                    <div className={styles.caseId}>
                      <p className={styles.caseName} title={r.student}>
                        {r.student}
                      </p>
                      <p className={styles.caseLrn}>{r.lrn}</p>
                    </div>
                    <Badge
                      variant={admCaseStatusVariant(caseStatus.key)}
                      className="shrink-0 rounded-md"
                    >
                      {caseStatus.label}
                    </Badge>
                  </div>

                  <div className={styles.caseMeta}>
                    <span className={styles.metaPill} title="Time elapsed">
                      <Clock size={11} aria-hidden />
                      {elapsed === null
                        ? "—"
                        : `${formatElapsedShort(elapsed)} ago`}
                    </span>
                    <span className={styles.metaPill} title="Date referred">
                      {r.endorsedAt
                        ? r.endorsedAt.slice(0, 10)
                        : (r.datePrepared ?? "—")}
                    </span>
                  </div>

                  <div className={styles.caseChain}>
                    <span className={styles.person}>
                      <span className={styles.personMascot} aria-hidden="true">
                        <StudentMascot name={r.preparedBy} size={24} />
                      </span>
                      <span className={styles.personText}>
                        <span className={styles.personRole}>Adviser</span>
                        <span className={styles.personName} title={r.preparedBy}>
                          {r.preparedBy}
                        </span>
                      </span>
                    </span>
                    <span className={styles.chainArrow} aria-hidden>
                      →
                    </span>
                    <span className={styles.person}>
                      <span className={styles.personMascot} aria-hidden="true">
                        <StudentMascot
                          name={reviewer}
                          character={reviewerMascot(r.consultReviewer)}
                          size={24}
                        />
                      </span>
                      <span className={styles.personText}>
                        <span className={styles.personRole}>Forwarded by</span>
                        <span className={styles.personName}>{reviewer}</span>
                      </span>
                    </span>
                  </div>

                  <div className={styles.caseFoot}>
                    <span className={styles.latestAction}>
                      {r.lastActionType ? (
                        <>
                          <span className={styles.latestMain}>
                            {friendlyActionType(r.lastActionType)}
                          </span>
                          <span className={styles.latestAt} aria-live="off">
                            {(() => {
                              const ms = r.lastActionAt
                                ? msSinceDate(r.lastActionAt, now)
                                : null;
                              return ms === null
                                ? "—"
                                : `${formatElapsedShort(ms)} ago`;
                            })()}
                          </span>
                        </>
                      ) : (
                        (() => {
                          const fb = latestActionFallback(r);
                          if (!fb) {
                            return <span className={styles.latestMain}>—</span>;
                          }
                          const ms = msSinceDate(fb.at, now);
                          return (
                            <>
                              <span className={styles.latestMain}>
                                {fb.label}
                              </span>
                              <span className={styles.latestAt} aria-live="off">
                                {ms === null
                                  ? "—"
                                  : `${formatElapsedShort(ms)} ago`}
                              </span>
                            </>
                          );
                        })()
                      )}
                    </span>
                    <div className={styles.caseActions}>
                      {r.meeting == null ? (
                        <Button
                          size="sm"
                          className="h-6 px-2 text-xs"
                          disabled={bookingThis || !bookable}
                          title={
                            bookable
                              ? "Book a parent meeting for this case"
                              : closedRow
                                ? "This referral was cancelled/resolved — meetings can no longer be booked"
                                : "Meetings can only be booked before certification"
                          }
                          onClick={() => onBook(r)}
                        >
                          {bookingThis ? (
                            <Loader2 className={styles.spin} aria-hidden="true" />
                          ) : (
                            <CalendarPlus className="size-3.5" aria-hidden="true" />
                          )}
                          {bookingThis ? "Booking…" : "Book schedule"}
                        </Button>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={styles.cardMenuBtn}
                            aria-label={`Actions for ${r.student}`}
                          >
                            <MoreHorizontal aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/coordinator/referrals/${encodeURIComponent(r.id)}`}
                            >
                              See details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => onHistory(historyTargetFor(r))}
                          >
                            Track case
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination
            currentPage={safePage}
            totalItems={rows.length}
            onPageChange={setPage}
          />
        </>
      )}
    </KanbanBoard>
  );
}
