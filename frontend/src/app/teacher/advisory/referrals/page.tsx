"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ReferStudentCard } from "./components/ReferStudentCard";
import {
  ReferralCancelDialog,
} from "./components/ReferralActionDialogs";
import {
  ReferralTrackDialog,
  type TrackableReferral,
} from "./components/ReferralTrackDialog";
import { useReopenReferral } from "./components/use-reopen-referral";
import { typeForDesk } from "./components/referral-types";
import { useMyReferrals, type ReferralRow } from "./components/use-my-referrals";
import { useReferralCancel } from "./components/use-referral-cancel";
import { ReferralsTable, STATUS_BADGE } from "./components/referrals-table";
import refStyles from "./components/referrals.module.css";
function TeacherAdvisoryReferralsView({ highlightId }: { highlightId: string | null }) {
  const {
    query,
    setQuery,
    setPage,
    setTakeover,
    referralsQuery,
    totalPages,
    safePage,
    goToPage,
    referrals,
    total,
    unfilteredTotal,
  } = useMyReferrals(highlightId);
  const [trackTarget, setTrackTarget] = React.useState<TrackableReferral | null>(null);
  const { reopen: reopenReferral, isPending: reopenPending } = useReopenReferral();
  const [reopenRowId, setReopenRowId] = React.useState<string | null>(null);
  const {
    cancelTarget,
    setCancelTarget,
    cancelReason,
    setCancelReason,
    cancelPending,
    actionError,
    setActionError,
    requestCancel,
    confirmCancel,
  } = useReferralCancel();
  const [newReferralOpen, setNewReferralOpen] = React.useState(false);
  const [admResubmitSignal, setAdmResubmitSignal] = React.useState(0);
  const isEmpty =
    !referralsQuery.isPending && !referralsQuery.isError && unfilteredTotal === 0;
  const handleAdmReferAgain = React.useCallback(() => {
    setNewReferralOpen(true);
    setAdmResubmitSignal((s) => s + 1);
  }, []);
  const handleTrack = React.useCallback((r: ReferralRow) => {
    const meta = STATUS_BADGE[r.status];
    const type = typeForDesk(r.targetRole);
    setTrackTarget({
      id: r.id,
      studentName: r.studentName,
      lrn: r.lrn,
      targetRole: r.targetRole,
      track: r.targetRole === "adm_coordinator" ? "adm" : "general",
      typeLabel: type.label,
      typeVariant: type.badgeVariant,
      status: r.status,
      statusLabel: meta.label,
      statusVariant: meta.variant,
      referredAt: r.referredAt,
      reason: r.reason,
      timeline: r.timeline ?? [],
      consultReviewer: r.consultReviewer ?? null,
      admStage: r.admStage ?? null,
      observationDate: r.observationDate ?? null,
      meetingAttended: r.meetingAttended ?? null,
      lastMeetingAt: r.lastMeetingAt ?? null,
      hasHomeVisit: r.hasHomeVisit ?? false,
      admApproved: r.admApproved ?? false,
      admApprovedAt: r.admApprovedAt ?? null,
      modulesSubmitted: r.modulesSubmitted ?? 0,
      modulesTotal: r.modulesTotal ?? 0,
      lastModuleAt: r.lastModuleAt ?? null,
      devicesReturned: r.devicesReturned ?? 0,
      certificationAt: r.certificationAt ?? null,
      resolvedAt: r.resolvedAt ?? null,
    });
  }, []);
  const handleReferAgain = React.useCallback((r: ReferralRow) => {
    if (r.track === "adm") {
      handleAdmReferAgain();
    } else {
      setReopenRowId(r.id);
      void reopenReferral(r).finally(() => {
        setReopenRowId((prev) => (prev === r.id ? null : prev));
      });
    }
  }, [handleAdmReferAgain, reopenReferral]);
  return (
    <section className={refStyles.page}>
      <div
        className={refStyles.layout}
        style={isEmpty && !newReferralOpen ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}
      >
        <div className={refStyles.body}>
          <ReferralsTable
            referrals={referrals}
            total={total}
            unfilteredTotal={unfilteredTotal}
            query={query}
            onQueryChange={(v) => {
              setQuery(v);
              setTakeover(true);
              setPage(1);
            }}
            safePage={safePage}
            totalPages={totalPages}
            goToPage={goToPage}
            highlightId={highlightId}
            referralsQuery={{
              isPending: referralsQuery.isPending,
              isError: referralsQuery.isError,
              isFetching: referralsQuery.isFetching,
              refetch: () => void referralsQuery.refetch(),
            }}
            onTrack={handleTrack}
            onRequestCancel={requestCancel}
            reopenPending={reopenPending}
            reopenRowId={reopenRowId}
            onReferAgain={handleReferAgain}
            onNewReferral={() => setNewReferralOpen(true)}
          />
        </div>
        {isEmpty && !newReferralOpen ? null : (
          <aside className={refStyles.sideList} aria-label="Refer a student">
            <ReferStudentCard
              open={newReferralOpen}
              onOpenChange={setNewReferralOpen}
              resubmitHintSignal={admResubmitSignal}
            />
          </aside>
        )}
      </div>
      <ReferralTrackDialog referral={trackTarget} onClose={() => setTrackTarget(null)} />
      <ReferralCancelDialog
        target={cancelTarget}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        pending={cancelPending}
        error={actionError}
        onClose={() => {
          if (!cancelPending) {
            setCancelTarget(null);
            setActionError(null);
          }
        }}
        onConfirm={confirmCancel}
      />
    </section>
  );
}
function TeacherAdvisoryReferralsPageWithHighlight() {
  const params = useSearchParams();
  return <TeacherAdvisoryReferralsView highlightId={params.get("highlight")} />;
}
export default function TeacherAdvisoryReferralsPage() {
  return (
    <React.Suspense fallback={<section className={refStyles.page} aria-busy="true" />}>
      <TeacherAdvisoryReferralsPageWithHighlight />
    </React.Suspense>
  );
}
