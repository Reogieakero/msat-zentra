"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { useNowTick } from "@/lib/clock";
import { useTerm } from "@/lib/term/TermContext";
import { markSelfNotified } from "@/lib/realtime/coordinatorChannel";
import { toast } from "@/components/ui/sonner";
import { fetchCoordinatorCaseDetail } from "@/services/coordinator/cases.service";
import type {
  AdmCaseRow,
  AdmFormRef,
  CoordinatorCaseDetail,
} from "@/services/coordinator/coordinator.types";
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
  const { activeTerm } = useTerm();
  const caseTermKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const detailQuery = useQuery({
    // Term-scoped: never show another term's case file.
    queryKey: ["coordinator-case", caseId, caseTermKey],
    queryFn: ({ signal }) => fetchCoordinatorCaseDetail(caseId, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const now = useNowTick();
  const router = useRouter();
  const queryClient = useQueryClient();
  const termId = activeTerm?.termId ?? "";
  const scopeLabel = activeTerm
    ? `${activeTerm.schoolYearName} · Term ${activeTerm.termNumber}`
    : "No active term";
  const [createTarget, setCreateTarget] = React.useState<AdmCaseRow | null>(null);
  const [certSheetOpen, setCertSheetOpen] = React.useState(false);
  const searchParams = useSearchParams();
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!createTarget) throw new Error("No referral selected.");
      const referralId = createTarget.id.replace(/^referral:/, "");
      const { data } = await apiClient.post("/api/adm/profiles", {
        referralId,
        termId,
      });
      return data as { id: string };
    },
    onSuccess: (profile) => {
      if (profile?.id) markSelfNotified(profile.id);
      void queryClient.invalidateQueries({ queryKey: ["coordinator-referrals"] });
      void queryClient.invalidateQueries({ queryKey: ["coordinator-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["coordinator-notifications"] });
      setCreateTarget(null);
      toast.success({
        title: "Learner profile created",
        description: "Opening the case file to continue toward certification.",
      });
      router.push(
        `/coordinator/referrals/${encodeURIComponent(profile.id)}?certify=1`,
      );
    },
    onError: (err) =>
      toast.error({
        title: "Could not create profile",
        description: apiErrorMessage(err),
      }),
  });
  const caseData = detailQuery.data ?? null;
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
    termId,
    scopeLabel,
    createTarget,
    setCreateTarget,
    createMutation,
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
  };
}
export type CoordinatorCaseView = ReturnType<typeof useCoordinatorCaseView>;
