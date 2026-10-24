"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { useNowTick } from "@/lib/clock";
import { markSelfNotified } from "@/lib/realtime/coordinatorChannel";
import { toast } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
import { fetchCoordinatorCaseDetail } from "@/services/coordinator/cases.service";
import type {
  AdmCaseRow,
  AdmFormRef,
  AdmMeeting,
  CoordinatorCaseDetail,
} from "@/services/coordinator/coordinator.types";
import { useCoordinatorBooking } from "../../components/use-coordinator-booking";
import { fetchOcForm01Detail, type OcForm01Detail } from "@/components/ocform01/ocform01";
import { buildGcForm03Data } from "@/services/guidance/gcform03.service";
import type { GcForm03Data } from "@/services/guidance/gcform03.types";
import {
  deriveAdmCaseStatus,
  endorsementRecommendation,
} from "@/services/coordinator/labels";
import type { CertSheetContext } from "../certification-sheet";
import { CASE_STEPS, type CaseStepId } from "../case-steps";
import { deriveChecklist } from "../eligibility-checklist-card";
export function useCoordinatorCaseView(caseId: string) {
  const detailQuery = useQuery({
    // The server scopes the case file — no client term in the key.
    queryKey: ["coordinator-case", caseId],
    queryFn: ({ signal }) => fetchCoordinatorCaseDetail(caseId, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const now = useNowTick();
  const router = useRouter();
  const queryClient = useQueryClient();
  const scopeLabel = "the current term";
  const [createTarget, setCreateTarget] = React.useState<AdmCaseRow | null>(null);
  const [certSheetOpen, setCertSheetOpen] = React.useState(false);
  const searchParams = useSearchParams();
  const dock = useDock();
  const createMutation = useMutation({
    mutationFn: async ({
      target,
    }: {
      target: AdmCaseRow;
      taskId: string | null;
    }) => {
      const referralId = target.id.replace(/^referral:/, "");
      const { data } = await apiClient.post("/api/adm/profiles", {
        referralId,
      });
      return data as { id: string };
    },
    onSuccess: (profile, vars) => {
      if (profile?.id) markSelfNotified(profile.id);
      void queryClient.invalidateQueries({ queryKey: ["coordinator-referrals"] });
      void queryClient.invalidateQueries({ queryKey: ["coordinator-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["coordinator-notifications"] });
      setCreateTarget(null);
      if (vars.taskId) {
        dock.completeTask(vars.taskId, `${vars.target.student} → profile`);
      }
      toast.success({
        title: "Learner profile created",
        description: "Opening the case file to continue toward certification.",
      });
      router.push(
        `/coordinator/referrals/${encodeURIComponent(profile.id)}?certify=1`,
      );
    },
    onError: (err, vars) => {
      if (vars.taskId) dock.failTask(vars.taskId, apiErrorMessage(err));
      toast.error({
        title: "Could not create profile",
        description: apiErrorMessage(err),
      });
    },
  });
  const caseData = detailQuery.data ?? null;
  // Reuse the referrals/overview booking flow so the case page books through
  // the same dialog, dock task, and invalidation path.
  const bookingRow = React.useMemo<AdmCaseRow | null>(() => {
    if (!caseData) return null;
    return {
      id:
        caseData.kind === "referral" && caseData.referralId
          ? `referral:${caseData.referralId}`
          : (caseData.profileId ?? caseData.id),
      lrn: caseData.lrn,
      student: caseData.student,
      grade: caseData.grade,
      stage: caseData.stage,
      eligibilityStatus: caseData.eligibilityStatus,
      preparedBy: caseData.preparedBy,
      datePrepared: caseData.datePrepared,
      approvedBy: caseData.approvedBy,
      approvalDate: caseData.approvalDate,
      forms: caseData.forms,
    };
  }, [caseData]);
  // The case detail leaves empty relations optional; the booking sheet only
  // reads ids/schedules, so fill the gaps rather than widening its types.
  const bookingMeetings = React.useMemo<AdmMeeting[]>(
    () =>
      (caseData?.meetings ?? []).map((m) => ({
        ...m,
        invitees: m.invitees ?? [],
        attachments: m.attachments ?? [],
      })),
    [caseData],
  );
  const booking = useCoordinatorBooking({
    selected: bookingRow,
    meetings: bookingMeetings,
    invalidateReferrals: () => {
      void detailQuery.refetch();
    },
  });
  const JOIN_EARLY_MS = 15 * 60_000;
  const hasAttendedMeeting = (caseData?.meetings ?? []).some(
    (mtg) => mtg.attended,
  );
  const hasPendingOutcome = (caseData?.meetings ?? []).some((mtg) => {
    if (mtg.attended) return false;
    const t = new Date(mtg.meetingDatetime).getTime();
    if (!Number.isFinite(t)) return false;
    return t - now <= JOIN_EARLY_MS;
  });
  const [preparingProfile, setPreparingProfile] = React.useState(false);
  const startCreateProfile = React.useCallback(
    async (d: CoordinatorCaseDetail) => {
      if (d.kind !== "referral" || !d.referralId) return;
      await Promise.resolve();
      setPreparingProfile(true);
      try {
        setCreateTarget({
          id: `referral:${d.referralId}`,
          lrn: d.lrn,
          student: d.student,
          grade: d.grade,
          stage: d.stage,
          eligibilityStatus: d.eligibilityStatus,
          preparedBy: d.preparedBy,
          datePrepared: d.datePrepared,
          approvedBy: d.approvedBy,
          approvalDate: d.approvalDate,
          forms: [],
        });
      } catch (err) {
        toast.error({
          title: "Could not start profile",
          description: apiErrorMessage(err),
        });
      } finally {
        setPreparingProfile(false);
      }
    },
    [],
  );
  const bridgeShouldOpen =
    !detailQuery.isPending &&
    caseData?.kind === "referral" &&
    hasAttendedMeeting &&
    !hasPendingOutcome;
  const [wasBridgeOpen, setWasBridgeOpen] = React.useState(false);
  if (bridgeShouldOpen !== wasBridgeOpen) {
    setWasBridgeOpen(bridgeShouldOpen);
    if (bridgeShouldOpen && caseData && caseData.kind === "referral") {
      void startCreateProfile(caseData);
    }
  }
  const profileCertifiable =
    (caseData?.kind === "profile" &&
      ![
        "certification",
        "principal_approval",
        "enrollment_monitoring",
        "completion",
      ].includes(caseData.stage)) ||
    false;
  const certContext: CertSheetContext | null =
    caseData?.kind === "profile" && caseData.profileId
      ? {
          profileId: caseData.profileId,
          student: caseData.student,
          hasReferral: caseData.referral !== null,
          hasAnecdotal: caseData.anecdotal !== null,
          meetingAttended: hasAttendedMeeting,
        }
      : null;
  const certifyRequested = searchParams.get("certify") === "1";
  const [wasCertifyRequested, setWasCertifyRequested] = React.useState(false);
  if (certifyRequested !== wasCertifyRequested) {
    setWasCertifyRequested(certifyRequested);
    if (certifyRequested && certContext && profileCertifiable) {
      setCertSheetOpen(true);
    }
  }
  const [anecdotalPreviewId, setAnecdotalPreviewId] = React.useState<
    string | null
  >(null);
  const [gcOpen, setGcOpen] = React.useState(false);
  const [gcData, setGcData] = React.useState<GcForm03Data | null>(null);
  const [gcLoading, setGcLoading] = React.useState(false);
  const [evidenceTarget, setEvidenceTarget] =
    React.useState<AdmFormRef | null>(null);
  const [endorsedNoticeOpen, setEndorsedNoticeOpen] = React.useState(false);
  const [meetingIdx, setMeetingIdx] = React.useState<number | null>(null);
  const stepParam = searchParams.get("step") as CaseStepId | null;
  const [activeTab, setActiveTab] = React.useState<CaseStepId>(
    CASE_STEPS.some((s) => s.id === stepParam) ? (stepParam as CaseStepId) : "referral",
  );
  const [wasStepParam, setWasStepParam] = React.useState<string | null>(null);
  if ((stepParam ?? null) !== wasStepParam) {
    setWasStepParam(stepParam ?? null);
    if (stepParam && CASE_STEPS.some((s) => s.id === stepParam)) {
      setActiveTab(stepParam);
    }
  }
  const activeStepIdx = Math.max(
    0,
    CASE_STEPS.findIndex((s) => s.id === activeTab),
  );
  function goStep(id: CaseStepId) {
    setActiveTab(id);
    setMeetingIdx(null);
  }
  function handleAttendedConfirmed() {
    setActiveTab("certify");
    if (certContext && profileCertifiable) setCertSheetOpen(true);
  }
  const latestMeetingId = React.useMemo(() => {
    const meetings = detailQuery.data?.meetings ?? [];
    let latest: string | null = null;
    let latestAt = -Infinity;
    for (const mtg of meetings) {
      const t = new Date(mtg.meetingDatetime).getTime();
      if (Number.isFinite(t) && t >= latestAt) {
        latestAt = t;
        latest = mtg.id;
      }
    }
    return latest;
  }, [detailQuery.data]);
  const orderedMeetings = React.useMemo(() => {
    const meetings = detailQuery.data?.meetings ?? [];
    return [...meetings].sort((a, b) =>
      b.meetingDatetime.localeCompare(a.meetingDatetime),
    );
  }, [detailQuery.data]);
  function seeEvidenceDetails(f: AdmFormRef) {
    const d = detailQuery.data;
    if (f.formType === "REFERRAL_FORM" && d?.referral && d?.anecdotal) {
      void openGcForm();
      return;
    }
    if (f.formType === "ANECDOTAL_REPORT" && d?.anecdotal) {
      const locked =
        d.stage === "principal_approval" &&
        !d.approvedBy &&
        d.eligibilityStatus === "eligible";
      if (locked) {
        setEndorsedNoticeOpen(true);
      } else {
        setAnecdotalPreviewId(d.anecdotal.id);
      }
      return;
    }
    setEvidenceTarget(f);
  }
  async function openGcForm() {
    const d = detailQuery.data;
    if (gcLoading || !d?.referral || !d?.anecdotal) return;
    if (gcData) {
      setGcOpen(true);
      return;
    }
    setGcLoading(true);
    try {
      let report: OcForm01Detail | null = null;
      try {
        report = await fetchOcForm01Detail(d.anecdotal.id);
      } catch {
        report = null;
      }
      const data = buildGcForm03Data(
        {
          student: d.student,
          grade: d.grade,
          section: d.anecdotal.section,
          category: d.anecdotal.category,
          anecdotalExcerpt: d.anecdotal.descriptionOfIncident,
          reason: d.referral.reason,
          recommendations: d.anecdotal.recommendations ?? undefined,
          referredBy: d.referral.referredBy,
          date: d.anecdotal.observationDate,
        },
        report,
        endorsementRecommendation(d.referral.notes) ?? "",
      );
      if (d.datePrepared) {
        data.receivedDate = d.datePrepared;
        data.counselorDate = d.datePrepared;
      }
      setGcData(data);
      setGcOpen(true);
    } finally {
      setGcLoading(false);
    }
  }
  const d = detailQuery.data ?? null;
  const caseStatus = d
    ? deriveAdmCaseStatus(
        d.stage,
        d.eligibilityStatus,
        d.approvedBy,
        d.referral?.status ?? null,
      )
    : { key: "filed", label: "Anecdotal filed" };
  const anecdotal = d?.anecdotal ?? null;
  const referral = d?.referral ?? null;
  const anecdotalLocked =
    !!d &&
    d.stage === "principal_approval" &&
    !d.approvedBy &&
    d.eligibilityStatus === "eligible";
  const hasMinutes = (d?.forms ?? []).some(
    (f) => f.formType === "MINUTES_OF_MEETING",
  );
  const hasHomeVisit = (d?.forms ?? []).some((f) => f.formType === "HV_FORM");
  const hasCertification = (d?.forms ?? []).some(
    (f) => f.formType === "CERTIFICATION" && f.status === "verified",
  );
  const checklist = deriveChecklist({
    hasReferral: referral !== null,
    hasAnecdotal: anecdotal !== null,
    meetingAttended: hasAttendedMeeting,
    hasMinutes,
    hasHomeVisit,
    hasCertification,
  });
  const stepDone: Record<CaseStepId, boolean> = {
    referral: referral !== null,
    anecdotal: anecdotal !== null,
    meetings: hasAttendedMeeting || hasHomeVisit,
    evidence: (d?.forms.length ?? 0) > 0,
    certify: hasCertification,
  };
  const activeStep = CASE_STEPS[activeStepIdx] ?? CASE_STEPS[0];
  return {
    detailQuery,
    now,
    scopeLabel,
    createTarget,
    setCreateTarget,
    createMutation,
    confirmCreate: () => {
      const target = createTarget;
      if (!target || createMutation.isPending) return;
      // Close at once — the shared Dock reports the request until it settles.
      setCreateTarget(null);
      let taskId: string | null = null;
      try {
        taskId = dock.startTask({
          kind: "generic",
          title: "Creating learner profile",
          description: `${target.student} → profile`,
        });
      } catch {
        taskId = null;
      }
      createMutation.mutate({ target, taskId });
    },
    preparingProfile,
    startCreateProfile,
    hasAttendedMeeting,
    profileCertifiable,
    certContext,
    certSheetOpen,
    setCertSheetOpen,
    latestMeetingId,
    orderedMeetings,
    anecdotalPreviewId,
    setAnecdotalPreviewId,
    gcOpen,
    setGcOpen,
    gcData,
    gcLoading,
    openGcForm,
    evidenceTarget,
    setEvidenceTarget,
    seeEvidenceDetails,
    endorsedNoticeOpen,
    setEndorsedNoticeOpen,
    meetingIdx,
    setMeetingIdx,
    activeTab,
    activeStepIdx,
    activeStep,
    goStep,
    handleAttendedConfirmed,
    caseData: d,
    caseStatus,
    anecdotal,
    referral,
    anecdotalLocked,
    hasMinutes,
    hasHomeVisit,
    hasCertification,
    checklist,
    stepDone,
    booking,
    bookingRow,
  };
}
export type CoordinatorCaseView = ReturnType<typeof useCoordinatorCaseView>;
