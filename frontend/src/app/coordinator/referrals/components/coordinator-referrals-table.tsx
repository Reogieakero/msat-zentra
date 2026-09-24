"use client";

import { Loader2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CoordinatorReferralsSkeleton } from "./coordinator-referrals-skeleton";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  admCaseStatusVariant,
  deriveAdmCaseStatus,
  formatManilaDate,
  formatManilaTime,
  meetingTooltip,
  stageLabel,
  eligibilityLabel,
  useNowTick,
  venueLabel,
  type AdmCaseRow,
} from "../../components/coordinator-data";
import type { HistoryTarget } from "../../components/CaseHistoryDialog";
import { historyTargetFor } from "../../components/CaseHistoryDialog";
import styles from "./coordinator-referrals-table.module.css";

interface CoordinatorReferralsTableProps {
  rows: AdmCaseRow[];
  /** Initial load: no data yet — full page skeleton. */
  isInitialLoading: boolean;
  /** Background refresh (search/filter/page/realtime): rows stay visible. */
  isSyncing: boolean;
  isError: boolean;
  isRefetching: boolean;
  hasActiveFilters: boolean;
  /** Row id currently being booked/rescheduled — only it disables. */
  bookPendingId: string | null;
  onRetry: () => void;
  onOpenCase: (row: AdmCaseRow) => void;
  onHistory: (target: HistoryTarget) => void;
  onBook: (row: AdmCaseRow) => void;
}

type MeetingLiveStatus = "attended" | "live" | "upcoming" | "overdue";

// Bookings carry no duration, so "live" is a window around the scheduled
// start: joinable 15 minutes early, live for 60 minutes after. Anything
// unattended past that window is overdue for an outcome record.
const LIVE_EARLY_MS = 15 * 60_000;
const LIVE_LATE_MS = 60 * 60_000;

function deriveMeetingLiveStatus(
  meeting: { datetime: string; attended: boolean },
  now: number,
): MeetingLiveStatus {
  if (meeting.attended) return "attended";
  const t = new Date(meeting.datetime).getTime();
  if (!Number.isFinite(t)) return "upcoming";
  const diff = t - now;
  if (diff <= LIVE_EARLY_MS && diff >= -LIVE_LATE_MS) return "live";
  if (diff > LIVE_EARLY_MS) return "upcoming";
  return "overdue";
}

const MEETING_LIVE_BADGE: Record<
  MeetingLiveStatus,
  { label: string; variant: "success" | "destructive" | "outline" | "warning" }
> = {
  attended: { label: "Attended", variant: "success" },
  live: { label: "Live", variant: "destructive" },
  upcoming: { label: "Upcoming", variant: "outline" },
  overdue: { label: "Overdue", variant: "warning" },
};

/* Mirrors the backend booking guards (POST /:id/meetings and
   POST /referral/:referralId/meetings both allow only pre-certification
   stages): early referrals (no profile yet) can always book; profiles can
   only book at the parent-meeting stage — profiles never sit at
   anecdotal/consultation, and certification+ is locked. Rows that fail this
   get no inline booking button (the backend 409 remains the backstop). */
function isBookableRow(r: AdmCaseRow): boolean {
  if (r.id.startsWith("referral:")) return true;
  return r.stage === "meeting_parents";
}

export function CoordinatorReferralsTable({
  rows,
  isInitialLoading,
  isSyncing,
  isError,
  isRefetching,
  hasActiveFilters,
  bookPendingId,
  onRetry,
  onOpenCase,
  onHistory,
  onBook,
}: CoordinatorReferralsTableProps) {
  // Ticks every 30s so Upcoming → Live → Overdue flips on its own —
  // no refetch needed for the badge to stay truthful.
  const now = useNowTick();
  if (isInitialLoading) {
    // Real filters header + pager stay mounted in the page around this —
    // only the table body is skeletonized here (header/pager mirrors would
    // duplicate the live controls).
    return <CoordinatorReferralsSkeleton rows={10} includeHeader={false} />;
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

  if (rows.length === 0) {
    return (
      <p className={styles.emptyText}>
        {hasActiveFilters
          ? `No cases match your search and filters.`
          : `No referrals found.`}
      </p>
    );
  }

  return (
    <div aria-busy={isSyncing || undefined}>
      {isSyncing ? (
        <p className={styles.syncBar} role="status" aria-live="polite">
          <Loader2 className={styles.spin} aria-hidden="true" />
          Syncing…
        </p>
      ) : null}
      <div className={styles.tableWrap}>
      <Table
        className={`${styles.table} ${styles.alertTable}`}
        aria-label="ADM referrals"
      >
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Case status</TableHead>
            <TableHead>Eligibility</TableHead>
            <TableHead>Meeting</TableHead>
            <TableHead>Meeting time</TableHead>
            <TableHead>Date referred</TableHead>
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
            const rowDate = r.endorsedAt ?? r.datePrepared;
            const meeting = r.meeting ?? null;
            // Only the row being booked disables — every other row stays
            // usable while its mutation runs.
            const bookingThis = bookPendingId === r.id;
            // Booking lives in the row ⋯ menu (never as an inline row
            // button) and only where the backend accepts it; locked
            // (post-meeting) cases keep the menu item disabled with the
            // reason instead of failing on confirm.
            const bookable = isBookableRow(r);
            const needsReschedule = meeting !== null && !meeting.attended;
            // Informative hover readout in Philippine time (stored ISO is
            // UTC — never slice it raw or an 8am booking shows predawn).
            const meetingTip = meeting ? meetingTooltip(meeting) : null;
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
                  {meeting ? (
                    <div className={styles.meetingCell}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span style={{ display: "inline-flex" }}>
                            {(() => {
                              const live = deriveMeetingLiveStatus(meeting, now);
                              const badge = MEETING_LIVE_BADGE[live];
                              return (
                                <Badge variant={badge.variant}>
                                  {live === "live" ? (
                                    <span
                                      className={styles.liveDot}
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                  {badge.label}
                                </Badge>
                              );
                            })()}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{meetingTip}</TooltipContent>
                      </Tooltip>
                    </div>
                  ) : (
                    <p className={styles.notBooked}>Not booked</p>
                  )}
                </TableCell>
                <TableCell>
                  {meeting ? (
                    <div>
                      <p className={`${styles.cellMain} ${styles.mono}`}>
                        {formatManilaDate(meeting.datetime)}
                      </p>
                      <div className={styles.studentSub}>
                        {formatManilaTime(meeting.datetime)} ·{" "}
                        {venueLabel(meeting.venue)}
                      </div>
                    </div>
                  ) : (
                    <p className={styles.cellMain}>—</p>
                  )}
                </TableCell>
                <TableCell>
                  <p className={styles.cellMain}>
                    {rowDate ? rowDate.slice(0, 10) : "—"}
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
                      {/* An attended meeting is done — no follow-up booking
                          is offered. Only unattended meetings reschedule
                          and only meeting-less cases schedule. */}
                      {meeting !== null && meeting.attended ? null : (
                        <DropdownMenuItem
                          disabled={bookingThis || !bookable}
                          title={
                            bookable
                              ? undefined
                              : "Meetings can only be booked before certification"
                          }
                          onSelect={() => onBook(r)}
                        >
                          {bookingThis
                            ? needsReschedule
                              ? "Rescheduling…"
                              : "Booking…"
                            : needsReschedule
                              ? "Reschedule meeting"
                              : "Schedule meeting"}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
