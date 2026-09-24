"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  CaseHistoryDialog,
} from "../components/CaseHistoryDialog";
import { useCoordinatorReferrals } from "./components/use-coordinator-referrals";
import { CoordinatorReferralsFilters } from "./components/coordinator-referrals-filters";
import { CoordinatorReferralsSkeleton } from "./components/coordinator-referrals-skeleton";
import { CoordinatorReferralsTable } from "./components/coordinator-referrals-table";
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

  return (
    <section className={styles.page} aria-label="Referrals">
      <CoordinatorReferralsFilters
        total={r.total}
        query={r.query}
        onQueryChange={r.setQuery}
        elig={r.elig}
        onEligChange={r.setElig}
        eligMenuLabel={r.eligMenuLabel}
        hasActiveFilters={r.hasActiveFilters}
        onClear={r.clearFilters}
      />
      <CoordinatorReferralsTable
        rows={r.rows}
        isInitialLoading={r.isInitialLoading}
        isSyncing={r.isSyncing}
        isError={r.referralsError}
        isRefetching={r.referralsRefetching}
        hasActiveFilters={r.hasActiveFilters}
        bookPendingId={r.bookPendingId}
        onRetry={r.refetchReferrals}
        onOpenCase={(row) => {
          window.open(
            `/coordinator/referrals/${encodeURIComponent(row.id)}`,
            "_blank",
            "noopener,noreferrer",
          );
        }}
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
        terms={r.terms}
        termId={r.termId}
        onTermChange={r.setTermId}
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
        onClose={() => r.setOutcomeTarget(null)}
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
