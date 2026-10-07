"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, MoreHorizontal, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  admCaseStatusVariant,
  consultReviewerLabel,
  deriveAdmCaseStatus,
  formatManilaDateLong,
  formatManilaTime,
  friendlyActionType,
  stageLabel,
  eligibilityLabel,
  venueLabel,
  latestActionFallback,
} from "@/services/coordinator/labels";
import { formatElapsedShort, msSinceDate } from "@/services/coordinator/utils";
import type {
  AdmCaseRow,
  AdmEligibility,
} from "@/services/coordinator/coordinator.types";
import { ELIG_OPTIONS } from "./coordinator-referrals-constants";
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
  total: number;
  query: string;
  onQueryChange: (v: string) => void;
  elig: "all" | AdmEligibility;
  onEligChange: (v: "all" | AdmEligibility) => void;
  eligMenuLabel: string;
  hasActiveFilters: boolean;
  onClear: () => void;
  /** Row id currently being booked/rescheduled — only it disables. */
  bookPendingId: string | null;
  /** Shared 30s clock from the hook — one interval per page, not per table. */
  now: number;
  onRetry: () => void;
  onHistory: (target: HistoryTarget) => void;
  onBook: (row: AdmCaseRow) => void;
}

/* Mirrors the backend booking guards (POST /:id/meetings and
   POST /referral/:referralId/meetings both allow only pre-certification
   stages): early referrals (no profile yet) can always book; profiles can
   only book at the parent-meeting stage — profiles never sit at
   anecdotal/consultation, and certification+ is locked. Rows that fail this
   get no inline booking button (the backend 409 remains the backstop). */
function isBookableRow(r: AdmCaseRow): boolean {
  if (r.referralStatus === "dismissed" || r.referralStatus === "resolved") return false;
  if (r.id.startsWith("referral:")) return true;
  return r.stage === "meeting_parents";
}

/* Card header shared by the empty and data states: title + live total on
   the left, search + eligibility filter + clear on the right (guidance
   grade-table pattern — controls live inside the card). */
function TableCardHeader({
  total,
  isSyncing,
  query,
  onQueryChange,
  elig,
  onEligChange,
  eligMenuLabel,
  hasActiveFilters,
  onClear,
}: {
  total: number;
  isSyncing: boolean;
  query: string;
  onQueryChange: (v: string) => void;
  elig: "all" | AdmEligibility;
  onEligChange: (v: "all" | AdmEligibility) => void;
  eligMenuLabel: string;
  hasActiveFilters: boolean;
  onClear: () => void;
}) {
  return (
    <CardHeader>
      <div className={styles.headerRow}>
        <div>
          <CardTitle className={styles.sectionTitle}>Referrals</CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Every student referred for Alternative Delivery Mode — {total} case
            {total === 1 ? "" : "s"}.{isSyncing ? " Syncing…" : ""}
          </CardDescription>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              style={{ height: "2rem", paddingLeft: "2rem" }}
              placeholder="Search name, LRN, or case ID…"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              aria-label="Search referrals"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                style={{ height: "2rem" }}
                aria-label={`Filter by status, currently: ${eligMenuLabel}`}
              >
                {elig === "all" ? "Status" : eligMenuLabel}
                {elig !== "all" && (
                  <span className={styles.filterDot} aria-hidden />
                )}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ELIG_OPTIONS.map((item) => (
                <DropdownMenuCheckboxItem
                  key={item.value}
                  checked={elig === item.value}
                  onCheckedChange={() => onEligChange(item.value)}
                >
                  {item.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X aria-hidden />
              Show all
            </Button>
          )}
        </div>
      </div>
    </CardHeader>
  );
}

function buildInterpretation(rows: AdmCaseRow[]): string {  const atMeeting = rows.filter((r) => r.stage === "meeting_parents").length;
  const unbooked = rows.filter((r) => !r.meeting && isBookableRow(r)).length;
  return (
    `${rows.length} case${rows.length === 1 ? "" : "s"} on this page` +
    ` · ${atMeeting} at parent meeting` +
    ` · ${unbooked} bookable without a meeting booked.`
  );
}

export function CoordinatorReferralsTable({
  rows,
  isInitialLoading,
  isSyncing,
  isError,
  isRefetching,
  total,
  query,
  onQueryChange,
  elig,
  onEligChange,
  eligMenuLabel,
  hasActiveFilters,
  onClear,
  bookPendingId,
  now,
  onRetry,
  onHistory,
  onBook,
}: CoordinatorReferralsTableProps) {
  const router = useRouter();
  if (isInitialLoading) {
    // Real filters header, rail, and pager stay mounted in the page around
    // this — only the table card is skeletonized here (other mirrors would
    // duplicate the live regions).
    return <CoordinatorReferralsSkeleton rows={10} layout="table" />;
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
      <Card className={styles.card}>
        <span className={styles.glowClip} aria-hidden="true">
          <span className={styles.cardGlow} />
        </span>
        <TableCardHeader
          total={total}
          isSyncing={isSyncing}
          query={query}
          onQueryChange={onQueryChange}
          elig={elig}
          onEligChange={onEligChange}
          eligMenuLabel={eligMenuLabel}
          hasActiveFilters={hasActiveFilters}
          onClear={onClear}
        />
        <CardContent>
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>
              {hasActiveFilters ? "No cases match your filters" : "No referrals found"}
            </p>
            <p className={styles.emptyHint}>
              {hasActiveFilters
                ? "Try a different search or clear the eligibility filter."
                : "New referrals will appear here once filed."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={styles.card} aria-busy={isSyncing || undefined}>
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      <TableCardHeader
        total={total}
        isSyncing={isSyncing}
        query={query}
        onQueryChange={onQueryChange}
        elig={elig}
        onEligChange={onEligChange}
        eligMenuLabel={eligMenuLabel}
        hasActiveFilters={hasActiveFilters}
        onClear={onClear}
      />
      <CardContent>
        <div className={styles.tableWrap}>
        <Table className={styles.table} aria-label="ADM referrals">
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Referred by</TableHead>
              <TableHead>Case status</TableHead>
              <TableHead>Eligibility</TableHead>
              <TableHead>Meeting time</TableHead>
              <TableHead>Date referred</TableHead>
              <TableHead>Latest action</TableHead>
              <TableHead>
                <span className={styles.srOnly}>Row actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
               const caseStatus = deriveAdmCaseStatus(
                 r.stage,
                 r.eligibilityStatus,
                 r.approvedBy,
                 r.referralStatus,
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
              const closedRow = r.referralStatus === "dismissed" || r.referralStatus === "resolved";
              const needsReschedule = meeting !== null && !meeting.attended;
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <p className={styles.cellMain}>{r.student}</p>
                    <p className={`${styles.cellSub} ${styles.mono}`}>
                      {r.lrn}
                    </p>
                  </TableCell>
                  {/* Source phrase so the coordinator sees at a glance whether
                      the case came straight to ADM or was endorsed by a desk
                      (nurse / guidance / LRPC). Filed-by name on hover. */}
                  <TableCell>
                    <p
                      className={styles.cellMain}
                      title={r.preparedBy ? `Filed by ${r.preparedBy}` : undefined}
                    >
                      {r.consultReviewer
                        ? `Endorsed by ${consultReviewerLabel(r.consultReviewer)}`
                        : "Direct referral"}
                    </p>
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
                      <div>
                        <p className={`${styles.cellMain} ${styles.mono}`}>
                          {formatManilaDateLong(meeting.datetime)}
                        </p>
                        <p className={styles.cellSub}>
                          {formatManilaTime(meeting.datetime)} ·{" "}
                          {venueLabel(meeting.venue)}
                        </p>
                      </div>
                    ) : (
                      <p className={styles.cellMain}>—</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className={styles.cellMain}>
                      {rowDate ? formatManilaDateLong(rowDate) : "—"}
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
                        // No audit trail for this case (legacy / unaudited
                        // rows) — fall back to the row's own latest
                        // timestamp so the column still reads the latest,
                        // whatever the status.
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
                        <DropdownMenuItem
                          onSelect={() =>
                            router.push(
                              `/coordinator/referrals/${encodeURIComponent(r.id)}`,
                            )
                          }
                        >
                          See details
                        </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => onHistory(historyTargetFor(r))}
                            >
                              Track case
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
                                : closedRow
                                  ? "This referral was cancelled/resolved — meetings can no longer be booked"
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
        <p className={styles.interpretation}>
          <span className={styles.interpretationLabel}>What it means · </span>
          {buildInterpretation(rows)}
        </p>
      </CardContent>
    </Card>
  );
}
