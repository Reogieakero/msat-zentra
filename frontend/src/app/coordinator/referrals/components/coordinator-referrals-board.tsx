"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CalendarPlus,
  Eye,
  History,
  Inbox,
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  admCaseStatusVariant,
  deriveAdmCaseStatus,
  eligibilityLabel,
  formatManilaDateLong,
  formatManilaTime,
  friendlyActionType,
  latestActionFallback,
  stageLabel,
  venueLabel,
} from "@/services/coordinator/labels";
import { formatElapsedShort, msSinceDate } from "@/lib/clock";
import type { AdmCaseRow } from "@/services/coordinator/coordinator.types";
import type { HistoryTarget } from "../../components/CaseHistoryDialog";
import { historyTargetFor } from "../../components/CaseHistoryDialog";
import { CoordinatorEmptyState } from "../../components/CoordinatorEmptyCard";
import { CoordinatorReferralsSkeleton } from "./coordinator-referrals-skeleton";
import { CoordinatorReferralsFilters } from "./coordinator-referrals-header";
import {
  BookedMeetingInfoPanel,
  type BookedMeetingInfo,
} from "@/components/session-booking/BookedMeetingInfoPanel";
import { buildInterpretation, isBookableRow } from "./coordinator-referrals-interpretation";
import styles from "./coordinator-referrals-board.module.css";

type StatusTabKey = "all" | "booked" | "need_review" | "endorsed";

const STATUS_TABS: { key: StatusTabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "booked", label: "Booked" },
  { key: "need_review", label: "Need review" },
  { key: "endorsed", label: "Endorsed" },
];

function rowMeetingInfo(r: AdmCaseRow): BookedMeetingInfo | null {
  const m = r.meeting;
  if (!m) return null;
  return {
    studentName: r.student,
    lrn: r.lrn,
    grade: r.grade,
    datetime: m.datetime,
    venue: m.venue,
    attended: m.attended,
    inviteeCount: m.inviteeIds?.length ?? 0,
  };
}

interface CoordinatorReferralsBoardProps {
  rows: AdmCaseRow[];

  isInitialLoading: boolean;

  isSyncing: boolean;
  isError: boolean;
  isRefetching: boolean;
  total: number;
  query: string;
  onQueryChange: (v: string) => void;
  hasActiveFilters: boolean;
  onClear: () => void;

  bookPendingId: string | null;

  now: number;
  onRetry: () => void;
  onHistory: (target: HistoryTarget) => void;
  onBook: (row: AdmCaseRow) => void;
}

/**
 * Referrals queue as a kanban board — a board shell (icon + title + count +
 * filters) over a grid of case cards instead of a data table. Each card shows
 * the learner sprite, ADM case status, eligibility, the booked meeting and the
 * latest action, with the same per-case actions menu as before.
 */
export function CoordinatorReferralsBoard({
  rows,
  isInitialLoading,
  isSyncing,
  isError,
  isRefetching,
  total,
  query,
  onQueryChange,
  hasActiveFilters,
  onClear,
  bookPendingId,
  now,
  onRetry,
  onHistory,
  onBook,
}: CoordinatorReferralsBoardProps) {
  const router = useRouter();

  const [statusTab, setStatusTab] = React.useState<StatusTabKey>("all");

  const counts = React.useMemo<Record<StatusTabKey, number>>(() => {
    let booked = 0;
    let needReview = 0;
    let endorsed = 0;
    for (const r of rows) {
      if (r.meeting) booked += 1;
      const key = deriveAdmCaseStatus(
        r.stage,
        r.eligibilityStatus,
        r.approvedBy,
        r.referralStatus,
      ).key;
      if (key === "need_review") needReview += 1;
      if (key === "endorsed") endorsed += 1;
    }
    return { all: rows.length, booked, need_review: needReview, endorsed };
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    if (statusTab === "all") return rows;
    if (statusTab === "booked") return rows.filter((r) => r.meeting != null);
    return rows.filter(
      (r) =>
        deriveAdmCaseStatus(
          r.stage,
          r.eligibilityStatus,
          r.approvedBy,
          r.referralStatus,
        ).key === statusTab,
    );
  }, [rows, statusTab]);

  const filters = (
    <CoordinatorReferralsFilters
      query={query}
      onQueryChange={onQueryChange}
      hasActiveFilters={hasActiveFilters}
      onClear={onClear}
    />
  );

  const statusTabs = (
    <div className={styles.statusTabs} role="tablist" aria-label="Filter cases by status">
      {STATUS_TABS.map((t) => {
        const active = statusTab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${styles.statusTab}${active ? ` ${styles.statusTabActive}` : ""}`}
            onClick={() => setStatusTab(t.key)}
          >
            {t.label}
            <span className={styles.statusTabCount}>{counts[t.key]}</span>
          </button>
        );
      })}
    </div>
  );

  if (isInitialLoading) {
    return <CoordinatorReferralsSkeleton rows={9} layout="board" />;
  }

  if (isError) {
    return (
      <div className={styles.errorBlock} role="alert">
        <p className={styles.errorText}>
          We couldn&apos;t load the referrals. Please check your internet
          connection and try again.
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
          {isRefetching ? "Retrying…" : "Try again"}
        </Button>
      </div>
    );
  }

  if (rows.length === 0 && !hasActiveFilters) {
    return (
      <KanbanBoard
        title="Referrals"
        icon={
          <span className="text-primary" aria-hidden>
            <Share2 size={14} />
          </span>
        }
        count={total}
        description="Every student referred for Alternative Delivery Mode."
        ariaLabel="ADM referrals"
        actions={filters}
      >
        <CoordinatorEmptyState
          icon={Inbox}
          title="No referrals found"
          hint="New referrals will appear here once filed."
        />
      </KanbanBoard>
    );
  }

  return (
    <KanbanBoard
      title="Referrals"
      icon={
        <span className="text-primary" aria-hidden>
          <Share2 size={14} />
        </span>
      }
      count={isSyncing ? undefined : total}
      description="Every student referred for Alternative Delivery Mode."
      ariaLabel="ADM referrals"
      actions={filters}
      headerCenter={statusTabs}
      footer={
        filteredRows.length > 0 ? (
          <p className={styles.interpretation}>
            <span className={styles.interpretationLabel}>What it means · </span>
            {buildInterpretation(filteredRows)}
          </p>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <CoordinatorEmptyState
          icon={Inbox}
          title="No cases match your filters"
          hint="Try a different search or clear the eligibility filter."
          action={
            <Button size="sm" variant="outline" onClick={onClear}>
              Show all
            </Button>
          }
        />
      ) : filteredRows.length === 0 ? (
        <CoordinatorEmptyState
          icon={Inbox}
          title="No cases in this view"
          hint="Try a different status tab."
        />
      ) : (
        <ul className={styles.caseGrid} aria-label="ADM referrals">
          {filteredRows.map((r) => {
            const caseStatus = deriveAdmCaseStatus(
              r.stage,
              r.eligibilityStatus,
              r.approvedBy,
              r.referralStatus,
            );
            const rowDate = r.endorsedAt ?? r.datePrepared;
            const meeting = r.meeting ?? null;
            const meetingInfo = rowMeetingInfo(r);
            const bookingThis = bookPendingId === r.id;
            const bookable = isBookableRow(r);
            const closedRow =
              r.referralStatus === "dismissed" || r.referralStatus === "resolved";
            const meetingPill = `${styles.metaPill}${meeting && !meeting.attended ? ` ${styles.metaPillBooked}` : ""}`;

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
                </div>

                <div className={styles.caseMeta}>
                  <Badge
                    variant={admCaseStatusVariant(caseStatus.key)}
                    className="shrink-0 rounded-md"
                    title={stageLabel(r.stage)}
                  >
                    {caseStatus.label}
                  </Badge>
                  <span
                    className={styles.metaPill}
                    title={`Eligibility: ${eligibilityLabel(r.eligibilityStatus)}`}
                  >
                    {eligibilityLabel(r.eligibilityStatus)}
                  </span>
                  {meeting ? (
                    <>
                      <span
                        className={meetingPill}
                        title={meeting.attended ? "Meeting attended" : "Booked meeting"}
                      >
                        <CalendarClock size={11} aria-hidden />
                        {meeting.attended ? "Attended" : "Booked"}
                      </span>
                      <span className={meetingPill} title="Meeting date">
                        {formatManilaDateLong(meeting.datetime)}
                      </span>
                      <span className={meetingPill} title="Meeting time">
                        {formatManilaTime(meeting.datetime)}
                      </span>
                      <span className={meetingPill} title="Venue">
                        {venueLabel(meeting.venue)}
                      </span>
                    </>
                  ) : (
                    <span className={styles.metaPill} title="Date referred">
                      {rowDate ? formatManilaDateLong(rowDate) : "—"}
                    </span>
                  )}
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
                            <span className={styles.latestMain}>{fb.label}</span>
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
                    {meeting === null ? (
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
                      <DropdownMenuContent align="end" className={styles.menu}>
                        <DropdownMenuItem
                          onSelect={() =>
                            router.push(
                              `/coordinator/referrals/${encodeURIComponent(r.id)}`,
                            )
                          }
                        >
                          <Eye aria-hidden />
                          See details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => onHistory(historyTargetFor(r))}
                        >
                          <History aria-hidden />
                          Track case
                        </DropdownMenuItem>
                        {meetingInfo !== null ? (
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <CalendarClock aria-hidden />
                              Booked info
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent
                              sideOffset={8}
                              className={styles.infoSub}
                            >
                              <BookedMeetingInfoPanel
                                info={meetingInfo}
                                onReschedule={() => onBook(r)}
                                reschedulePending={bookingThis}
                              />
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </KanbanBoard>
  );
}
