"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  ReferralCancelDialog,
} from "./components/ReferralActionDialogs";
import { ReferralFormDialog } from "./components/ReferralFormDialog";
import { useReferralSubmitDock } from "@/components/shared/referral-submit/referral-submit-dock-context";
import {
  ReferralTrackDialog,
  type TrackableReferral,
} from "./components/ReferralTrackDialog";
import { useReopenReferral } from "./components/use-reopen-referral";
import { typeForDesk, findStaff } from "./components/referral-types";
import type { ReferFormSeed } from "./components/refer-form";
import { useMyReferrals, type ReferralRow } from "./components/use-my-referrals";
import { useReferralCancel } from "./components/use-referral-cancel";
import { ReferralsTable, statusBadge } from "./components/referrals-table";
import refStyles from "./components/referrals.module.css";
function seedForReferAgain(row: ReferralRow): ReferFormSeed {
  const typeKey = row.targetRole === "adm_coordinator" ? "adm" : "other";
  let staffValue = "";
  if (typeKey === "adm" && row.consultReviewer) {
    const candidate = `adm:${row.consultReviewer}`;
    if (findStaff(candidate)) staffValue = candidate;
  } else if (typeKey === "other") {
    const candidate = `other:${row.targetRole}`;
    if (findStaff(candidate)) staffValue = candidate;
  }
  return { anecdotalId: row.anecdotalId ?? null, typeKey, staffValue };
}
function TeacherAdvisoryReferralsView({ highlightId }: { highlightId: string | null }) {
  const {
    query,
    setQuery,
    referralsQuery,
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
  const [referralSeed, setReferralSeed] = React.useState<ReferFormSeed | null>(null);
  // Bottom-right submit dock lives at root level (survives page navigation).
  const submitDock = useReferralSubmitDock();
  const handleAdmReferAgain = React.useCallback((row: ReferralRow) => {
    setReferralSeed(seedForReferAgain(row));
  }, []);
  const handleTrack = React.useCallback((r: ReferralRow) => {
    const meta = statusBadge(r.status, r.dismissedByRole);
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
      dismissedByRole: r.dismissedByRole ?? null,
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
      handleAdmReferAgain(r);
    } else {
      setReopenRowId(r.id);
      void reopenReferral(r).finally(() => {
        setReopenRowId((prev) => (prev === r.id ? null : prev));
      });
    }
  }, [handleAdmReferAgain, reopenReferral]);
  return (
    <section className={refStyles.page}>
      <div className={refStyles.layout}>
        <div className={refStyles.body}>
          <ReferralsTable
            referrals={referrals}
            total={total}
            unfilteredTotal={unfilteredTotal}
            query={query}
            onQueryChange={(v) => {
              setQuery(v);
            }}
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
            onNewReferral={() => setReferralSeed({})}
          />
        </div>
      </div>
      <ReferralTrackDialog referral={trackTarget} onClose={() => setTrackTarget(null)} />
      <ReferralFormDialog
        open={referralSeed !== null}
        onClose={() => setReferralSeed(null)}
        seed={referralSeed}
        onSubmitStart={submitDock.startSubmit}
        onSubmitEnd={submitDock.finishSubmit}
      />
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
