"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CalendarPlus,
  History,
  Inbox,
  Loader2,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill, type PillTone } from "@/components/ui/pill";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { InsightCallout } from "@/components/ui/insight-callout";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
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
import { toSlug } from "@/lib/slug";
import type { AdmCaseRow } from "@/services/coordinator/coordinator.types";
import type { HistoryTarget } from "../../components/CaseHistoryDialog";
import { historyTargetFor } from "../../components/CaseHistoryDialog";
import { CoordinatorEmptyState } from "../../components/CoordinatorEmptyCard";
import { CoordinatorReferralsSkeleton, CoordinatorReferralsCardsSkeleton } from "./coordinator-referrals-skeleton";
import { CoordinatorReferralsFilters } from "./coordinator-referrals-header";
import {
  BookedMeetingInfoContent,
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

// Badge variants from `admCaseStatusVariant` mapped onto the shared pill tones.
const STATUS_TONE: Record<
  ReturnType<typeof admCaseStatusVariant>,
  PillTone
> = {
  amber: "amber",
  success: "green",
  default: "blue",
  destructive: "red",
  secondary: "violet",
  outline: "neutral",
  red: "red",
};

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

  isPageLoading: boolean;
  isSyncing: boolean;
  isError: boolean;
  isRefetching: boolean;
  total: number;
  query: string;
  onQueryChange: (v: string) => void;
  hasActiveFilters: boolean;

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
  isPageLoading,
  isError,
  isRefetching,
  query,
  onQueryChange,
  hasActiveFilters,
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

  const searchTerm = query.trim().toLowerCase();

  const filteredRows = React.useMemo(() => {
    const base =
      statusTab === "all"
        ? rows
        : statusTab === "booked"
          ? rows.filter((r) => r.meeting != null)
          : rows.filter(
              (r) =>
                deriveAdmCaseStatus(
                  r.stage,
                  r.eligibilityStatus,
                  r.approvedBy,
                  r.referralStatus,
                ).key === statusTab,
            );
    if (searchTerm === "") return base;
    // Filter the loaded page instantly as the clerk types (same feel as the
    // nurse desks); the debounced server query then swaps in matches from the
    // rest of the desk.
    return base.filter((r) =>
      `${r.student} ${r.lrn} ${r.id} ${stageLabel(r.stage)}`
        .toLowerCase()
        .includes(searchTerm),
    );
  }, [rows, statusTab, searchTerm]);

  const filters = (
    <CoordinatorReferralsFilters
      query={query}
      onQueryChange={onQueryChange}
    />
  );

  const statusTabs = (
    <div className={styles.filterRow} role="tablist" aria-label="Filter cases by status">
      {STATUS_TABS.map((t) => {
        const active = statusTab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-pressed={active}
            className={styles.filterButton}
            onClick={() => setStatusTab(t.key)}
          >
            <Pill tone={active ? "blue" : "neutral"}>
              {t.label}
              <span className={styles.statusTabCount}>{counts[t.key]}</span>
            </Pill>
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
      description="Every student referred for Alternative Delivery Mode."
      ariaLabel="ADM referrals"
      actions={filters}
      headerCenter={statusTabs}
      footer={
        !isPageLoading && filteredRows.length > 0 ? (
          <InsightCallout className={styles.interpretation}>
            <span className={styles.interpretationLabel}>What it means · </span>
            {buildInterpretation(filteredRows)}
          </InsightCallout>
        ) : null
      }
    >
      {isPageLoading ? (
        <CoordinatorReferralsCardsSkeleton rows={9} />
      ) : rows.length === 0 || filteredRows.length === 0 ? (
        <div className={styles.emptyCallout}>
          <InsightCallout role="status">
            {rows.length === 0 || searchTerm !== "" || hasActiveFilters
              ? "No referrals match your search or filters. Try a different name, LRN, or case ID."
              : "No cases in this view. Try a different status tab."}
          </InsightCallout>
        </div>
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
            const detailsHref = `/coordinator/referrals/${encodeURIComponent(toSlug(r.student))}`;

            return (
              <li
                key={r.id}
                className={styles.caseCard}
                role="link"
                tabIndex={0}
                aria-label={`Open details for ${r.student}`}
                onClick={() => router.push(detailsHref)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(detailsHref);
                  }
                }}
              >
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
                  <Pill
                    tone={STATUS_TONE[admCaseStatusVariant(caseStatus.key)]}
                    className="shrink-0 rounded-md"
                    label={stageLabel(r.stage)}
                  >
                    {caseStatus.label}
                  </Pill>
                  <Pill
                    tone="neutral"
                    label={`Eligibility: ${eligibilityLabel(r.eligibilityStatus)}`}
                  >
                    {eligibilityLabel(r.eligibilityStatus)}
                  </Pill>
                  {meeting ? (
                    <>
                      <Pill
                        tone={meeting.attended ? "green" : "blue"}
                        label={meeting.attended ? "Meeting attended" : "Booked meeting"}
                      >
                        <CalendarClock size={11} aria-hidden />
                        {meeting.attended ? "Attended" : "Booked"}
                      </Pill>
                      <Pill tone="neutral" label="Meeting date">
                        {formatManilaDateLong(meeting.datetime)}
                      </Pill>
                      <Pill tone="neutral" label="Meeting time">
                        {formatManilaTime(meeting.datetime)}
                      </Pill>
                      <Pill tone="neutral" label="Venue">
                        {venueLabel(meeting.venue)}
                      </Pill>
                    </>
                  ) : (
                    <Pill tone="neutral" label="Date referred">
                      {rowDate ? formatManilaDateLong(rowDate) : "—"}
                    </Pill>
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
                  <div
                    className={styles.caseActions}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
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
                    {meetingInfo !== null ? (
                      <Popover>
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={styles.cardMenuBtn}
                                  aria-label={`Booked meeting info for ${r.student}`}
                                >
                                  <CalendarClock aria-hidden />
                                </Button>
                              </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={6}>
                              Booked info
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <PopoverContent align="end" sideOffset={8} className="w-80 p-3">
                          <BookedMeetingInfoContent info={meetingInfo} />
                        </PopoverContent>
                      </Popover>
                    ) : null}
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={styles.cardMenuBtn}
                            aria-label={`Track case for ${r.student}`}
                            onClick={() => onHistory(historyTargetFor(r))}
                          >
                            <History aria-hidden />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6}>
                          Track case
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
