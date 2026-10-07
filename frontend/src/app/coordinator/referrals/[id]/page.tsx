"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderCard } from "@/components/ui/FolderCard";
import { CardModal } from "@/components/ui/CardModal";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import {
  fetchOcForm01Detail,
  type OcForm01Detail,
} from "@/components/ocform01/ocform01";
import { GcForm03PreviewDialog } from "@/app/guidance/adm/components/GcForm03PreviewDialog";
import {
  buildGcForm03Data,
  type GcForm03Data,
} from "@/app/guidance/adm/components/gcform03-data";
import { anecdotalCategoryColor } from "@/app/guidance/referrals/components/guidance-referrals-format";
import {
  admCaseStatusVariant,
  apiErrorMessage,
  deriveAdmCaseStatus,
  eligibilityLabel,
  endorsementRecommendation,
  fetchCoordinatorCaseDetail,
  friendlyWords,
  stageLabel,
  useNowTick,
  type AdmCaseRow,
  type AdmFormRef,
  type CoordinatorCaseDetail,
} from "../../components/coordinator-data";
import {
  FORM_DOT,
  FORM_LABELS,
} from "../components/coordinator-referrals-constants";
import { CoordinatorReferralsCreateDialog } from "../components/coordinator-referrals-create-dialog";
import { CoordinatorReferralsForwardDialog } from "../components/coordinator-referrals-confirm-dialogs";
import {
  CertificationSheet,
  type CertSheetContext,
} from "./certification-sheet";
import { EvidenceDetailsDialog } from "./evidence-details-dialog";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { markSelfNotified } from "@/lib/realtime/coordinatorChannel";
import { toast } from "@/components/ui/sonner";
import { ParentMeetingCard } from "./parent-meeting-card";
import { CoordinatorCaseSkeleton } from "./coordinator-case-skeleton";
import { CASE_STEPS, type CaseStepId } from "./case-steps";
import {
  deriveChecklist,
  EligibilityChecklistCard,
} from "./eligibility-checklist-card";
import styles from "./case-page.module.css";

function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={styles.backBtn}
      onClick={() => router.push("/coordinator/referrals")}
      aria-label="Back to referrals"
    >
      <ChevronLeft aria-hidden="true" />
      <span>Back to referrals</span>
    </button>
  );
}

/* Auto-ask endorsement to Principal on the full case file: once the case
   sits certified (stage certification + recommendation recorded) and
   unforwarded, pop the forward confirm every visit until it is endorsed.
   Dismissing stays dismissed for this visit — the flip guard refires only
   when a newly qualifying case loads. */
function ForwardToPrincipalGate({
  caseData,
  onForwarded,
}: {
  caseData: CoordinatorCaseDetail | null;
  onForwarded: () => void;
}) {
  const queryClient = useQueryClient();
  const [forwardOpen, setForwardOpen] = React.useState(false);
  const forwardMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const { data } = await apiClient.patch(`/api/adm/${profileId}/stage`, {
        stage: "principal_approval",
      });
      return data;
    },
    onSuccess: (data, profileId) => {
      void data;
      markSelfNotified(profileId);
      void queryClient.invalidateQueries({ queryKey: ["coordinator-referrals"] });
      void queryClient.invalidateQueries({ queryKey: ["coordinator-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["coordinator-notifications"] });
      setForwardOpen(false);
      toast.success({
        title: "Endorsed to Principal",
        description: "The case is now locked awaiting the Principal's signature.",
      });
      onForwarded();
    },
    onError: (err) =>
      toast.error({
        title: "Could not endorse case",
        description: apiErrorMessage(err),
      }),
  });

  const details = caseData?.certificationDetails as
    | { recommendation?: unknown }
    | null;
  const hasRecommendation =
    typeof details?.recommendation === "string" &&
    details.recommendation.trim().length > 0;
  const eligible =
    caseData?.kind === "profile" &&
    !!caseData.profileId &&
    caseData.stage === "certification" &&
    !caseData.approvedBy &&
    hasRecommendation;
  // Auto-pop the forward confirm once the case becomes certifiable
  // (derived state during render — guarded so it only fires on transition).
  const [wasEligible, setWasEligible] = React.useState(false);
  if (eligible !== wasEligible) {
    setWasEligible(eligible);
    if (eligible && !forwardOpen) setForwardOpen(true);
  }

  return (
    <CoordinatorReferralsForwardDialog
      target={forwardOpen && caseData ? { student: caseData.student } : null}
      pending={forwardMutation.isPending}
      onClose={() => setForwardOpen(false)}
      onConfirm={() => {
        if (caseData?.profileId && !forwardMutation.isPending) {
          forwardMutation.mutate(caseData.profileId);
        }
      }}
    />
  );
}

function CoordinatorCasePageInner({ caseId }: { caseId: string }) {
  const detailQuery = useQuery({
    queryKey: ["coordinator-case", caseId],
    queryFn: ({ signal }) => fetchCoordinatorCaseDetail(caseId, signal),
    staleTime: 30_000,
  });
  const now = useNowTick();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Learner-profile bridge for early referrals: an attended meeting means
  // nothing without a profile to certify, so the case file offers creation
  // inline and lands on the profile case with the cert sheet queued.
  // Profiles are filed under the session's active scope — no term picker.
  const { activeTerm } = useTerm();
  const termId = activeTerm?.termId ?? "";
  const scopeLabel = activeTerm
    ? `${activeTerm.schoolYearName} · Term ${activeTerm.termNumber}`
    : "No active term";
  const [createTarget, setCreateTarget] = React.useState<AdmCaseRow | null>(
    null,
  );
  const [certSheetOpen, setCertSheetOpen] = React.useState(false);
  const searchParams = useSearchParams();

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!createTarget) throw new Error("No referral selected.");
      const referralId = createTarget.id.replace(/^referral:/, "");
      // studentId omitted on purpose — the backend derives (or provisions)
      // the student from the referral itself.
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
      // ?certify=1 lands on the profile case with the certification sheet
      // already open (one shot — plain visits never pop it).
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

  // Auto-display the profile bridge: attendance logged but no profile
  // (so no certification yet) pops the create dialog on visit — unless an
  // outcome still needs recording, so the two popups never stack.
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

  // Tracked so the button reports Preparing… and stays disabled for the
  // resolve. The resolve itself is idempotent GETs (terms + case detail),
  // so a repeated call only costs a redundant read — the actual profile
  // mutation stays guarded by createMutation.isPending.
  const [preparingProfile, setPreparingProfile] = React.useState(false);
  const startCreateProfile = React.useCallback(
    async (d: CoordinatorCaseDetail) => {
      if (d.kind !== "referral" || !d.referralId) return;
      // Yield so a render-phase caller (auto-bridge) commits first — the
      // flag flips from a microtask, never synchronously during render.
      await Promise.resolve();
      setPreparingProfile(true);
    // No account check here — the backend auto-provisions roster-only
    // learners, and files the profile under the session's active term.
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

  // Opens on the false→true flip only, synced during render — closing the
  // dialog stays closed until the case genuinely qualifies again.
  // Render-phase (not an effect): the async resolve below only touches
  // state from promise continuations, never synchronously during render.
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

  // Certification lives at page level now: one sheet, opened from the
  // header, from a fresh attendance save, or from a ?certify=1 landing.
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
  const [wasCertifyRequested, setWasCertifyRequested] =
    React.useState(false);
  if (certifyRequested !== wasCertifyRequested) {
    setWasCertifyRequested(certifyRequested);
    if (certifyRequested && certContext && profileCertifiable) {
      setCertSheetOpen(true);
    }
  }

  function handleAttendedConfirmed() {
    // Parents attended → skip the home visit path and land on the final
    // wizard step, then slide the certification fill-up straight in.
    setActiveTab("certify");
    if (certContext && profileCertifiable) setCertSheetOpen(true);
  }

  // Only the latest schedule carries the live countdown — older
  // entries render as plain history.
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

  // Carousel order: latest reschedule first; a single (never
  // rescheduled) meeting is simply position 1 of 1.
  const orderedMeetings = React.useMemo(() => {
    const meetings = detailQuery.data?.meetings ?? [];
    return [...meetings].sort((a, b) =>
      b.meetingDatetime.localeCompare(a.meetingDatetime),
    );
  }, [detailQuery.data]);

  // File overlays — same previews other roles open: the official
  // GCForm-01 sheet for the anecdotal report, and the filled GCForm-03
  // referral form (view-only) rebuilt from the case + its GCForm-01.
  const [anecdotalPreviewId, setAnecdotalPreviewId] = React.useState<
    string | null
  >(null);
  const [gcOpen, setGcOpen] = React.useState(false);
  const [gcData, setGcData] = React.useState<GcForm03Data | null>(null);
  const [gcLoading, setGcLoading] = React.useState(false);
  // Per-evidence details overlay for rows without a full official preview
  // (minutes, certification, home visit). Referral + anecdotal rows open
  // their previews directly instead.
  const [evidenceTarget, setEvidenceTarget] =
    React.useState<AdmFormRef | null>(null);
  const [endorsedNoticeOpen, setEndorsedNoticeOpen] = React.useState(false);
  // Parent-meetings carousel — one schedule visible at a time. Null
  // means "follow the latest schedule"; chevrons pin an explicit index.
  const [meetingIdx, setMeetingIdx] = React.useState<number | null>(null);
  // Tabbed wizard — one section at a time, each with its own instructing
  // card (What / Why / Action). Deep-linkable via ?step=referral etc.;
  // invalid values fall back to the first tab.
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

  // Evidence "See details": referral + anecdotal rows open their full
  // official previews; everything else opens the details overlay. An
  // endorsed case keeps its anecdotal locked behind the notice modal.
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
      // Stamp the case's own dates instead of today so the viewed form
      // matches the referral timeline.
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

  if (detailQuery.isPending) {
    return (
      <section className={styles.page} aria-label="Case file">
        <BackButton />
        <CoordinatorCaseSkeleton />
      </section>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <section className={styles.page} aria-label="Case file">
        <BackButton />
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            We couldn&apos;t load this case file.{" "}
            {apiErrorMessage(detailQuery.error)}
          </p>
          <Button
            size="sm"
            variant="outline"
            className={styles.contrastBtn}
            disabled={detailQuery.isRefetching}
            onClick={() => detailQuery.refetch()}
          >
            {detailQuery.isRefetching ? (
              <Loader2
                style={{ width: "1rem", height: "1rem" }}
                aria-hidden="true"
              />
            ) : null}
            {detailQuery.isRefetching ? "Loading…" : "Try again"}
          </Button>
        </div>
      </section>
    );
  }

  const d = detailQuery.data;
   const caseStatus = deriveAdmCaseStatus(
     d.stage,
     d.eligibilityStatus,
     d.approvedBy,
     d.referral?.status ?? null,
   );
  const anecdotal = d.anecdotal;
  const referral = d.referral;
  // Endorsed to Principal (awaiting signature) locks the anecdotal file:
  // the folder shows a notice modal instead of the report. Revision cases
  // (returned/ineligible) stay openable so the evidence can be fixed, and
  // access returns fully once the Principal signs.
  const anecdotalLocked =
    d.stage === "principal_approval" &&
    !d.approvedBy &&
    d.eligibilityStatus === "eligible";
  // Derived checklist input — mirrors backend evaluateAdmEligibility.
  // Eligibility itself stays server-derived; this only visualises it.
  const hasMinutes = d.forms.some((f) => f.formType === "MINUTES_OF_MEETING");
  const hasHomeVisit = d.forms.some((f) => f.formType === "HV_FORM");
  const hasCertification = d.forms.some(
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
    evidence: d.forms.length > 0,
    certify: hasCertification,
  };
  const activeStep = CASE_STEPS[activeStepIdx] ?? CASE_STEPS[0];

  return (
    <section className={styles.page} aria-label={`Case file for ${d.student}`}>
      <BackButton />

      <header className={styles.header}>
        <span className={styles.glowClip} aria-hidden="true">
          <span className={styles.cardGlow} />
        </span>
        <div className={styles.headerSection}>
          <h1 className={styles.studentName}>{d.student}</h1>
          <p className={styles.studentSub}>
            <span className={styles.inlineLabel}>LRN</span>
            <span className={styles.inlineValue}>{d.lrn}</span>
          </p>
          {d.grade ? (
            <p className={styles.studentSub}>
              <span className={styles.inlineLabel}>Grade Level</span>
              <span className={styles.inlineValue}>{d.grade}</span>
            </p>
          ) : null}
          <div className={styles.headerActions}>
            {d.kind === "referral" &&
            orderedMeetings.some((mtg) => mtg.attended) ? (
              <Button
                disabled={createMutation.isPending || preparingProfile}
                aria-busy={
                  createMutation.isPending || preparingProfile || undefined
                }
                onClick={() => void startCreateProfile(d)}
              >
                {createMutation.isPending || preparingProfile ? (
                  <Loader2
                    className="animate-spin"
                    aria-hidden="true"
                    style={{ width: "0.875rem", height: "0.875rem" }}
                  />
                ) : null}
                {createMutation.isPending
                  ? "Creating…"
                  : preparingProfile
                    ? "Preparing…"
                    : "Create learner profile"}
              </Button>
            ) : null}
            {certContext && profileCertifiable && hasAttendedMeeting ? (
              <Button onClick={() => setCertSheetOpen(true)}>
                Continue to certification
              </Button>
            ) : null}
          </div>
        </div>
        <div className={styles.headerDivider} aria-hidden="true" />
        <div className={styles.headerSection}>
          <div className={styles.sideField}>
            <span className={styles.sideFieldLabel}>Stage</span>
            <span className={styles.sideFieldValue}>
              {stageLabel(d.stage)}
            </span>
          </div>
          <div className={styles.sideField}>
            <span className={styles.sideFieldLabel}>Eligibility</span>
            <span className={styles.sideFieldValue}>
              {eligibilityLabel(d.eligibilityStatus)}
            </span>
          </div>
          <div className={styles.badgeRow}>
            <Badge variant="secondary">ADM</Badge>
            <Badge
              variant={admCaseStatusVariant(caseStatus.key)}
              title={stageLabel(d.stage)}
            >
              {caseStatus.label}
            </Badge>
            <Badge
              variant={
                d.eligibilityStatus === "eligible"
                  ? "secondary"
                  : d.eligibilityStatus === "ineligible"
                    ? "destructive"
                    : "outline"
              }
            >
              {eligibilityLabel(d.eligibilityStatus)}
            </Badge>
          </div>
          <div className={styles.headerNotes}>
            <p className={styles.headerNote}>
              Referred by {d.preparedBy || "—"}
            </p>
            {d.datePrepared ? (
              <p className={styles.headerNote}>{d.datePrepared}</p>
            ) : null}
            {d.approvedBy ? (
              <p className={styles.headerNote}>
                Approved by {d.approvedBy}
              </p>
            ) : null}
            {d.approvalDate ? (
              <p className={styles.headerNote}>{d.approvalDate}</p>
            ) : null}
          </div>
        </div>
        <div className={styles.headerDivider} aria-hidden="true" />
        <div className={styles.headerSteps} role="tablist" aria-label="Case file sections">
          {CASE_STEPS.map((s, i) => {
            const selected = s.id === activeTab;
            const done = stepDone[s.id];
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`case-panel-${s.id}`}
                id={`case-tab-${s.id}`}
                className={styles.tabBtn}
                data-selected={selected ? "true" : "false"}
                data-done={done ? "true" : "false"}
                onClick={() => goStep(s.id)}
              >
                <span className={styles.tabDot} aria-hidden="true">
                  {done ? <Check size={12} strokeWidth={3} /> : `${i + 1}`}
                </span>
                <span>{s.short}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Tabbed wizard: one section at a time, each guided by its own
          instructing card (What / Why / Action). The sticky checklist
          visualises the derived eligibility beside the active step. */}
      <div className={styles.wizardLayout}>
        <div className={styles.wizardMain}>
          <div className={styles.instructCard} aria-live="polite">
            <span className={styles.glowClip} aria-hidden="true">
              <span className={styles.cardGlow} />
            </span>
            <div className={styles.instructHead}>
              <p className={styles.instructKicker}>
                Step {activeStepIdx + 1} of {CASE_STEPS.length} · {activeStep.label}
                {stepDone[activeStep.id] ? " · Done" : ""}
              </p>
              <div className={styles.carouselNav}>
                <Button
                  size="icon"
                  variant="outline"
                  className={styles.carouselBtn}
                  disabled={activeStepIdx <= 0}
                  onClick={() => goStep(CASE_STEPS[activeStepIdx - 1].id)}
                  aria-label="Previous step"
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className={styles.carouselBtn}
                  disabled={activeStepIdx >= CASE_STEPS.length - 1}
                  onClick={() => goStep(CASE_STEPS[activeStepIdx + 1].id)}
                  aria-label="Next step"
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </div>
            <dl className={styles.instructList}>
              <div className={styles.instructRow}>
                <dt>What</dt>
                <dd>{activeStep.what}</dd>
              </div>
              <div className={styles.instructRow}>
                <dt>Why</dt>
                <dd>{activeStep.why}</dd>
              </div>
              <div className={styles.instructRow}>
                <dt>Next</dt>
                <dd>{activeStep.action}</dd>
              </div>
            </dl>
          </div>

          <div
            role="tabpanel"
            id={`case-panel-${activeTab}`}
            aria-labelledby={`case-tab-${activeTab}`}
          >
          {activeTab === "anecdotal" ? (
          <>
          {anecdotal ? (
            <div className={styles.folderCenter}>
            <button
              type="button"
              className={styles.folderBtn}
              onClick={() =>
                anecdotalLocked
                  ? setEndorsedNoticeOpen(true)
                  : setAnecdotalPreviewId(anecdotal.id)
              }
              aria-label={
                anecdotalLocked
                  ? `Anecdotal report for ${d.student} is locked awaiting the Principal's signature`
                  : `Open ${d.student}'s anecdotal report file (GCForm-01)`
              }
            >
              <FolderCard
                label="GCForm-01"
                sublabel={`${anecdotal.observationDate}, ${anecdotal.section}`}
                folderColor={anecdotalCategoryColor(anecdotal.category)}
                files={[
                  {
                    name: `OCForm-01_${anecdotal.observationDate}`,
                    tag: friendlyWords(anecdotal.category),
                    icon: "doc" as const,
                  },
                ]}
              />
            </button>
            </div>
          ) : (
            <p className={styles.muted}>No anecdotal write-up on file.</p>
          )}
          </>
          ) : null}
          {activeTab === "referral" ? (
          <>
          {referral && anecdotal ? (
            <div className={styles.folderCenter}>
              <button
                type="button"
                className={styles.folderBtn}
                onClick={() => void openGcForm()}
                disabled={gcLoading}
                aria-label={`Open the GCForm-03 referral form file for ${d.student}`}
              >
                <FolderCard
                  label="GCForm-03"
                  sublabel={`${d.student}, ${anecdotal.observationDate}`}
                  folderColor={anecdotalCategoryColor(anecdotal.category)}
                  files={[
                    {
                      name: `GCForm-03_${anecdotal.observationDate}`,
                      tag: friendlyWords(anecdotal.category),
                      icon: "doc" as const,
                    },
                  ]}
                />
              </button>
              {gcLoading ? (
                <Loader2
                  className="animate-spin"
                  aria-hidden
                  style={{ width: "0.875rem", height: "0.875rem" }}
                />
              ) : null}
            </div>
          ) : (
            <p className={styles.muted}>No referral form on file.</p>
          )}
          </>
          ) : null}
          {activeTab === "evidence" ? (
          <div className={styles.card}>
          <span className={styles.glowClip} aria-hidden="true">
            <span className={styles.cardGlow} />
          </span>
          <h2 className={styles.cardTitle}>Evidence chain</h2>
          {d.forms.length === 0 ? (
            d.kind === "referral" && hasAttendedMeeting ? (
              <ul className={styles.evidenceList}>
                {[
                  { label: "Referral on file", ok: referral !== null },
                  { label: "Anecdotal report on file", ok: anecdotal !== null },
                  { label: "Parent meeting attended", ok: hasAttendedMeeting },
                ].map((e) => (
                  <li key={e.label} className={styles.evidenceItem}>
                    <Badge variant={e.ok ? "success" : "outline"}>
                      {e.ok ? "On file" : "Missing"}
                    </Badge>
                    <span>{e.label}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.headerNote}>
                {d.kind === "referral"
                  ? "No learner profile yet — create one to start collecting evidence."
                  : "No forms recorded yet."}
              </p>
            )
          ) : (
            <ul className={styles.evidenceList}>
              {d.forms.map((f) => (
                <li key={f.id} className={styles.evidenceItem}>
                  <span
                    className={styles.evidenceDot}
                    style={{
                      backgroundColor: FORM_DOT[f.status] ?? "#d4d4d4",
                    }}
                    aria-hidden
                  />
                  <span>
                    {FORM_LABELS[f.formType] ?? friendlyWords(f.formType)}
                  </span>
                  <Badge variant="outline">{friendlyWords(f.status)}</Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className={styles.logBtn}
                    style={{ marginLeft: "auto" }}
                    onClick={() => seeEvidenceDetails(f)}
                    aria-label={`See details for ${FORM_LABELS[f.formType] ?? friendlyWords(f.formType)}`}
                  >
                    See details
                  </Button>
                </li>
              ))}
            </ul>
          )}
          </div>
          ) : null}
          {activeTab === "meetings" ? (
          <div className={styles.card}>
          <span className={styles.glowClip} aria-hidden="true">
            <span className={styles.cardGlow} />
          </span>
          {(() => {
            // Carousel over the schedule history, latest first — position
            // 1 is always the latest reschedule (or the only schedule).
            // Chevron-right steps back into older history.
            const total = orderedMeetings.length;
            const activeIdx =
              meetingIdx === null
                ? 0
                : Math.min(Math.max(0, meetingIdx), total - 1);
            return (
              <>
                <div className={styles.cardTitleRow}>
                  <h2 className={styles.cardTitle}>Parent meetings</h2>
                  {total > 1 ? (
                    <div className={styles.carouselNav}>
                      <Button
                        size="icon"
                        variant="outline"
                        className={styles.carouselBtn}
                        disabled={activeIdx <= 0}
                        onClick={() => setMeetingIdx(activeIdx - 1)}
                        aria-label="Previous meeting schedule"
                      >
                        <ChevronLeft aria-hidden="true" />
                      </Button>
                      <span className={styles.carouselCount}>
                        {activeIdx + 1} of {total}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className={styles.carouselBtn}
                        disabled={activeIdx >= total - 1}
                        onClick={() => setMeetingIdx(activeIdx + 1)}
                        aria-label="Next meeting schedule"
                      >
                        <ChevronRight aria-hidden="true" />
                      </Button>
                    </div>
                  ) : null}
                </div>
                {total === 0 ? (
                  <p className={styles.muted}>
                    No meeting booked yet — schedule one in school or as a
                    home visitation.
                  </p>
                ) : (
                  <ul className={styles.evidenceList}>
                    {orderedMeetings.map((m, i) => (
                      <ParentMeetingCard
                        key={m.id}
                        meeting={m}
                        now={now}
                        isLatest={m.id === latestMeetingId}
                        active={i === activeIdx}
                        onChanged={() => {
                          void detailQuery.refetch();
                        }}
                        onAttendedConfirmed={handleAttendedConfirmed}
                      />
                    ))}
                  </ul>
                )}
              </>
            );
          })()}
          </div>
          ) : null}
          {activeTab === "certify" ? (
          <div className={styles.card}>
            <span className={styles.glowClip} aria-hidden="true">
              <span className={styles.cardGlow} />
            </span>
            <h2 className={styles.cardTitle}>Recommendation &amp; certification</h2>
            {hasCertification ? (
              <p className={styles.cardText} style={{ marginBottom: 0 }}>
                Certification is verified on this case — see the Evidence
                chain for its details. Endorsing passes it to the Principal
                for signature.
              </p>
            ) : d.kind === "referral" ? (
              <>
                <p className={styles.muted}>
                  This is still an early referral with no learner profile —
                  create one first so the certification can be filed against
                  it.
                </p>
                <div className={styles.attendBtns} style={{ justifyContent: "flex-start" }}>
                  <Button
                    disabled={createMutation.isPending || preparingProfile}
                    aria-busy={
                      createMutation.isPending || preparingProfile || undefined
                    }
                    onClick={() => void startCreateProfile(d)}
                  >
                    {createMutation.isPending
                      ? "Creating…"
                      : preparingProfile
                        ? "Preparing…"
                        : "Create learner profile"}
                  </Button>
                </div>
              </>
            ) : !hasAttendedMeeting ? (
              <p className={styles.muted} style={{ marginBottom: 0 }}>
                Log an attended parent meeting on step 3 first — the
                certification fill-up opens once attendance is confirmed.
              </p>
            ) : !profileCertifiable ? (
              <p className={styles.cardText} style={{ marginBottom: 0 }}>
                This case already carries a certification — no further
                fill-up is needed here.
              </p>
            ) : (
              <>
                <p className={styles.muted}>
                  Everything is gathered — write the ADM recommendation to
                  certify the case.
                </p>
                <div className={styles.attendBtns} style={{ justifyContent: "flex-start" }}>
                  <Button onClick={() => setCertSheetOpen(true)}>
                    Continue to certification
                  </Button>
                </div>
              </>
            )}
          </div>
          ) : null}
          </div>
        </div>

        <div className={styles.wizardSide}>
          <EligibilityChecklistCard
            checklist={checklist}
            eligibilityStatus={d.eligibilityStatus}
            stepIndex={activeStepIdx}
            stepTotal={CASE_STEPS.length}
            onPrevStep={
              activeStepIdx > 0
                ? () => goStep(CASE_STEPS[activeStepIdx - 1].id)
                : undefined
            }
            onNextStep={
              activeStepIdx < CASE_STEPS.length - 1
                ? () => goStep(CASE_STEPS[activeStepIdx + 1].id)
                : undefined
            }
          />
        </div>
      </div>

      {/* Same file overlays other roles open */}
      <OcForm01PreviewDialog
        recordId={anecdotalPreviewId}
        onClose={() => setAnecdotalPreviewId(null)}
      />
      <CardModal
        open={endorsedNoticeOpen}
        onClose={() => setEndorsedNoticeOpen(false)}
        title="Case endorsed"
        description="This case is endorsed to the Principal and locked awaiting signature."
        size="sm"
      >
        <p className={styles.muted} style={{ margin: 0 }}>
          The anecdotal report can&apos;t be opened until the Principal
          signs or returns the case.
        </p>
        <div className={styles.modalActions}>
          <Button
            type="button"
            onClick={() => setEndorsedNoticeOpen(false)}
          >
            Understood
          </Button>
        </div>
      </CardModal>
      <CoordinatorReferralsCreateDialog
        target={createTarget}
        scopeLabel={scopeLabel}
        onClose={() => setCreateTarget(null)}
        onConfirm={() => createMutation.mutate()}
        pending={createMutation.isPending}
        canConfirm={Boolean(termId) && !createMutation.isPending}
      />
      <CertificationSheet
        open={certSheetOpen}
        context={certContext}
        onClose={() => setCertSheetOpen(false)}
        onCertified={() => {
          void detailQuery.refetch();
        }}
      />
      <ForwardToPrincipalGate
        caseData={detailQuery.data ?? null}
        onForwarded={() => {
          void detailQuery.refetch();
        }}
      />
      <EvidenceDetailsDialog
        target={evidenceTarget}
        meetings={orderedMeetings}
        certificationDetails={d.certificationDetails}
        onClose={() => setEvidenceTarget(null)}
      />
      {gcOpen && gcData ? (
        <GcForm03PreviewDialog
          open
          data={gcData}
          confirming={false}
          onClose={() => setGcOpen(false)}
          onConfirm={() => {}}
          viewOnly
        />
      ) : null}
    </section>
  );
}

export default function CoordinatorCasePage() {
  const params = useParams<{ id: string | string[] }>();
  const raw = params?.id;
  const encoded = Array.isArray(raw) ? raw[0] : (raw ?? "");
  const caseId = decodeURIComponent(encoded ?? "");

  if (!caseId) {
    return (
      <section className={styles.page} aria-label="Case file">
        <BackButton />
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>Missing case id.</p>
        </div>
      </section>
    );
  }

  return (
    <React.Suspense
      fallback={
        <section className={styles.page} aria-label="Case file">
          <BackButton />
          <CoordinatorCaseSkeleton />
        </section>
      }
    >
      <CoordinatorCasePageInner caseId={caseId} />
    </React.Suspense>
  );
}
