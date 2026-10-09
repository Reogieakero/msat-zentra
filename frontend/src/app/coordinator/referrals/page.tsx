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
import { CoordinatorPageHeader } from "../components/CoordinatorPageHeader";
import { PageHeaderSkeleton } from "@/app/principal/components/skeletons/PageHeaderSkeleton";
import styles from "./components/coordinator-referrals.module.css";

function CoordinatorReferralsPageInner() {
  const r = useCoordinatorReferrals();
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");
  const openedFor = React.useRef<string | null>(null);
  const { rows, isInitialLoading, selected, setSelected } = r;

  React.useEffect(() => {
    if (!highlight || openedFor.current === highlight) return;
    if (isInitialLoading || selected) return;
    const match = rows.find((row) => row.id === highlight);
    if (match) {
      openedFor.current = highlight;
      setSelected(match);
    }
  }, [highlight, rows, isInitialLoading, selected, setSelected]);

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
    <section
      className={
        !r.isInitialLoading && !r.referralsError && r.rows.length === 0 && !r.hasActiveFilters
          ? `${styles.page} ${styles.pageEmpty}`
          : styles.page
      }
      aria-label="Referrals"
      aria-busy={r.isInitialLoading || undefined}
    >
      {r.isInitialLoading ? (
        <PageHeaderSkeleton />
      ) : r.referralsError || r.rows.length > 0 || r.hasActiveFilters ? (
        <CoordinatorPageHeader
          title="Referrals"
          description="ADM intake queue — review referred students and manage their case files."
        />
      ) : null}
      <div className={styles.contentSingle}>
        {!r.referralsError &&
        !(r.rows.length === 0 && !r.hasActiveFilters && !r.isInitialLoading) ? (
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
            now={r.now}
            onRetry={r.refetchReferrals}
            onHistory={r.setHistoryTarget}
            onBook={r.bookForRow}
          />

          {!r.isInitialLoading && !r.referralsError && r.total > 0 ? (
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

      <CoordinatorReferralsAdvanceDialog
        target={r.advanceTarget}
        pending={r.advancePending}
        onClose={() => r.setAdvanceTarget(null)}
        onConfirm={r.confirmAdvance}
      />

      <CoordinatorReferralsForwardDialog
        target={r.forwardTarget}
        pending={r.forwardPending}
        onClose={() => r.setForwardTarget(null)}
        onConfirm={r.confirmForward}
      />

      <CoordinatorReferralsCreateDialog
        target={r.createTarget}
        scopeLabel={r.scopeLabel}
        onClose={() => r.setCreateTarget(null)}
        onConfirm={r.confirmCreate}
        pending={r.createPending}
        canConfirm={r.canCreate}
      />

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
