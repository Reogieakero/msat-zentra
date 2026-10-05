"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { CaseHistoryDialog } from "../components/CaseHistoryDialog";
import { useCoordinatorReferrals } from "./components/use-coordinator-referrals";
import { CoordinatorReferralsSkeleton } from "./components/coordinator-referrals-skeleton";
import { CoordinatorReferralsTable } from "./components/coordinator-referrals-table";
import { CoordinatorReferralsRail } from "./components/coordinator-referrals-rail";
import { CoordinatorReferralsPager } from "./components/coordinator-referrals-pager";
import { CoordinatorReferralsCaseSheet } from "./components/coordinator-referrals-case-sheet";
import {
  CoordinatorReferralsAdvanceDialog,
  CoordinatorReferralsForwardDialog,
} from "./components/coordinator-referrals-confirm-dialogs";
import { CoordinatorReferralsCreateDialog } from "./components/coordinator-referrals-create-dialog";
import { CoordinatorReferralsBookDialog } from "./components/coordinator-referrals-book-dialog";
import { CoordinatorReferralsOutcomeDialog } from "./components/coordinator-referrals-outcome-dialog";
import styles from "./components/coordinator-referrals.module.css";

function CoordinatorReferralsPageInner() {
  const r = useCoordinatorReferrals();
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");
  const openedFor = React.useRef<string | null>(null);
  const { rows, isInitialLoading, selected, setSelected } = r;

  // Deep-link from the overview forwards table (?highlight=<rowId>):
  // open the matching case file once its page loads. No-ops when the id
  // is not on the current page so filters/pagination stay untouched.
  React.useEffect(() => {
    if (!highlight || openedFor.current === highlight) return;
    if (isInitialLoading || selected) return;
    const match = rows.find((row) => row.id === highlight);
    if (match) {
      openedFor.current = highlight;
      setSelected(match);
    }
  }, [highlight, rows, isInitialLoading, selected, setSelected]);

  // Auto-ask endorsement: opening the case file on a certified-but-
  // unforwarded case pops the forward confirm every visit until the case is
  // endorsed. Dismissing stays dismissed for this sheet opening (the flip
  // guard only refires on a newly selected row).
  const autoForwardEligible =
    r.selected !== null &&
    r.selected.stage === "certification" &&
    !r.selected.approvedBy;
  const [wasAutoForward, setWasAutoForward] = React.useState(false);
  if (autoForwardEligible !== wasAutoForward) {
    setWasAutoForward(autoForwardEligible);
    if (autoForwardEligible && r.forwardTarget === null && r.selected) {
      r.setForwardTarget(r.selected);
    }
  }

  return (
    <section className={styles.page} aria-label="Referrals">
      <div className={styles.contentSingle}>
        {!r.referralsError ? (
          <CoordinatorReferralsRail
            stageCounts={r.stageCounts}
            totalReferred={r.totalReferred}
            isLoading={r.isInitialLoading}
          />
        ) : null}
        <div className={styles.main}>
          <CoordinatorReferralsTable
            rows={r.rows}
            isInitialLoading={r.isInitialLoading}
            isSyncing={r.isSyncing}
            isError={r.referralsError}
            isRefetching={r.referralsRefetching}
            total={r.total}
            query={r.query}
            onQueryChange={r.setQuery}
            elig={r.elig}
            onEligChange={r.setElig}
            eligMenuLabel={r.eligMenuLabel}
            hasActiveFilters={r.hasActiveFilters}
            onClear={r.clearFilters}
            bookPendingId={r.bookPendingId}
            onRetry={r.refetchReferrals}
            onHistory={r.setHistoryTarget}
            onBook={r.bookForRow}
          />
          {/* During initial load the table skeleton below already reserves the
              pager space, so nothing renders here (no duplicated skeleton). */}
          {!r.isInitialLoading && !r.referralsError ? (
            <CoordinatorReferralsPager
              total={r.total}
              start={r.start}
              end={r.end}
              page={r.safePage}
              totalPages={r.totalPages}
              onPageChange={(next) => r.setPage(next)}
            />
          ) : null}
        </div>
      </div>

      {/* Case file */}
      <CaseHistoryDialog
        target={r.historyTarget}
        onClose={() => r.setHistoryTarget(null)}
      />
      <CoordinatorReferralsCaseSheet
        selected={r.selected}
        isProfile={r.selectedProfileId !== null}
        meetings={r.meetings}
        meetingsPending={r.meetingsPending}
        meetingsError={r.meetingsError}
        now={r.now}
        onRetryMeetings={r.refetchMeetings}
        onClose={r.closeSheet}
        onBook={r.openBook}
        onOutcome={r.openOutcome}
        onAdvance={r.setAdvanceTarget}
        onForward={r.setForwardTarget}
        onPrepareCreate={(row) => void r.prepareCreate(row)}
        prepareCreatePending={r.prepareCreatePending}
        bookPendingId={r.bookPendingId}
      />

      {/* Advance confirm */}
      <CoordinatorReferralsAdvanceDialog
        target={r.advanceTarget}
        pending={r.advancePending}
        onClose={() => r.setAdvanceTarget(null)}
        onConfirm={r.confirmAdvance}
      />

      {/* Forward confirm */}
      <CoordinatorReferralsForwardDialog
        target={r.forwardTarget}
        pending={r.forwardPending}
        onClose={() => r.setForwardTarget(null)}
        onConfirm={r.confirmForward}
      />

      {/* Create profile */}
      <CoordinatorReferralsCreateDialog
        target={r.createTarget}
        scopeLabel={r.scopeLabel}
        onClose={() => r.setCreateTarget(null)}
        onConfirm={r.confirmCreate}
        pending={r.createPending}
        canConfirm={r.canCreate}
      />

      {/* Book parent meeting — shared booking dialog (same as nurse/guidance).
          Modal only, never opens the case sheet. */}
      <CoordinatorReferralsBookDialog
        open={r.bookOpen}
        selected={r.bookTarget ?? r.selected}
        rescheduleMeeting={r.rescheduleMeeting}
        venuePreset={r.bookVenuePreset}
        pending={r.bookPending}
        serverError={r.bookError}
        onClose={r.closeBook}
        onSubmit={(fields) => r.confirmBook(fields)}
      />

      {/* Record meeting outcome */}
      <CoordinatorReferralsOutcomeDialog
        target={r.outcomeTarget}
        attended={r.outcomeAttended}
        onAttendedChange={r.setOutcomeAttended}
        minutes={r.outcomeMinutes}
        onMinutesChange={r.setOutcomeMinutes}
        logbook={r.outcomeLogbook}
        onLogbookChange={r.setOutcomeLogbook}
        inviteeIds={r.outcomeInviteeIds}
        onInviteeIdsChange={r.setOutcomeInviteeIds}
        onClose={r.closeOutcome}
        onConfirm={r.confirmOutcome}
        pending={r.outcomePending}
      />
    </section>
  );
}

export default function CoordinatorReferralsPage() {
  return (
    <React.Suspense
      fallback={
        <section className={styles.page} aria-label="Referrals">
          <CoordinatorReferralsSkeleton rows={10} />
        </section>
      }
    >
      <CoordinatorReferralsPageInner />
    </React.Suspense>
  );
}
