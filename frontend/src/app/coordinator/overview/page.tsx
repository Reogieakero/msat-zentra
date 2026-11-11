"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CaseHistoryDialog,
  type HistoryTarget,
} from "../components/CaseHistoryDialog";
import { useCoordinatorOverview } from "./components/use-coordinator-overview";
import { useCoordinatorBooking } from "../referrals/components/use-coordinator-booking";
import { CoordinatorReferralsBookDialog } from "../referrals/components/coordinator-referrals-book-dialog";
import { CoordinatorOverviewKpis } from "./components/coordinator-overview-kpis";
import { CoordinatorOverviewAttentionDialog } from "./components/coordinator-overview-attention-dialog";
import { CoordinatorOverviewForwards } from "./components/coordinator-overview-forwards";
import { CoordinatorOverviewBoards } from "./components/coordinator-overview-boards";
import {
  CoordinatorOverviewError,
  CoordinatorOverviewSkeleton,
} from "./components/coordinator-overview-states";
import { PageEmptyCallout } from "@/components/shared/page-empty-callout";
import styles from "./components/coordinator-overview.module.css";

export default function CoordinatorOverviewPage() {
  const [historyTarget, setHistoryTarget] =
    React.useState<HistoryTarget | null>(null);
  const [attentionOpen, setAttentionOpen] = React.useState(false);
  const overview = useCoordinatorOverview();
  const queryClient = useQueryClient();
  const invalidateReferrals = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["coordinator-referrals"] });
    void queryClient.invalidateQueries({ queryKey: ["coordinator-notifications"] });
  }, [queryClient]);
  const booking = useCoordinatorBooking({
    selected: null,
    meetings: [],
    invalidateReferrals,
  });

  if (overview.isPending) return <CoordinatorOverviewSkeleton />;
  if (overview.isError) {
    return (
      <CoordinatorOverviewError
        onRetry={overview.refetch}
        isRefetching={overview.isRefetching}
      />
    );
  }

  // No ADM activity at all → one centered callout instead of empty boards.
  const isEmpty =
    overview.referredToMe === 0 &&
    overview.certificationsIssued === 0 &&
    overview.activeEnrolled === 0 &&
    overview.forwards.rows.length === 0 &&
    overview.booked.rows.length === 0 &&
    overview.devices.oldestOut.length === 0 &&
    overview.stageDonut.every((entry) => entry.value === 0);

  if (isEmpty) {
    return (
      <section className={styles.page}>
        <PageEmptyCallout>
          No ADM activity for the selected term yet. Referrals, certifications,
          and device tracking will appear here once cases are filed.
        </PageEmptyCallout>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.mainCol}>
        <CoordinatorOverviewKpis
          attentionTotal={overview.attentionTotal}
          attentionReady={overview.attentionReady}
          attentionError={overview.attentionError}
          allClear={overview.allClear}
          referredToMe={overview.referredToMe}
          certificationsIssued={overview.certificationsIssued}
          awaitingPrincipal={overview.awaitingPrincipal}
          activeEnrolled={overview.activeEnrolled}
          onReview={() => setAttentionOpen(true)}
        />

        <CoordinatorOverviewBoards
          stageDonut={overview.stageDonut}
          devicesIssued={overview.devices.data?.issued ?? null}
          devicesReturned={overview.devices.data?.returned ?? null}
          devicesPending={overview.devices.isPending}
          oldestOut={overview.devices.oldestOut}
          bookedMeetings={overview.booked.rows}
          bookedPending={overview.booked.isPending}
          now={overview.now}
        />

        <CoordinatorOverviewForwards
          rows={overview.forwards.rows}
          isPending={overview.forwards.isPending}
          isError={overview.forwards.isError}
          isRefetching={overview.forwards.isRefetching}
          now={overview.now}
          bookPendingId={booking.bookPendingId}
          onRetry={overview.forwards.refetch}
          onHistory={setHistoryTarget}
          onBook={booking.bookForRow}
        />
      </div>

      <CoordinatorOverviewAttentionDialog
        open={attentionOpen}
        onClose={() => setAttentionOpen(false)}
        attention={overview.attention}
        attentionError={overview.attentionError}
        isRetrying={overview.devices.isRefetching}
        onRetry={overview.devices.refetch}
      />

      <CaseHistoryDialog
        target={historyTarget}
        onClose={() => setHistoryTarget(null)}
      />

      <CoordinatorReferralsBookDialog
        open={booking.bookOpen}
        selected={booking.bookTarget}
        rescheduleMeeting={booking.rescheduleMeeting}
        venuePreset={booking.bookVenuePreset}
        pending={booking.bookPending}
        serverError={booking.bookError}
        onClose={booking.closeBook}
        onSubmit={booking.confirmBook}
      />
    </section>
  );
}
