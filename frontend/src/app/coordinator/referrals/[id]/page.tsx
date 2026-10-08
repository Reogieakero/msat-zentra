"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { GcForm03PreviewDialog } from "@/app/guidance/adm/components/GcForm03PreviewDialog";
import { CoordinatorReferralsCreateDialog } from "../components/coordinator-referrals-create-dialog";
import { CoordinatorReferralsForwardDialog } from "../components/coordinator-referrals-confirm-dialogs";
import { CertificationSheet } from "./certification-sheet";
import { EvidenceDetailsDialog } from "./evidence-details-dialog";
import { apiClient } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { markSelfNotified } from "@/lib/realtime/coordinatorChannel";
import { toast } from "@/components/ui/sonner";
import { CoordinatorCaseSkeleton } from "./coordinator-case-skeleton";
import { EligibilityChecklistCard } from "./eligibility-checklist-card";
import { CASE_STEPS } from "./case-steps";
import type { CoordinatorCaseDetail } from "@/services/coordinator/coordinator.types";
import { useCoordinatorCaseView } from "./components/use-coordinator-case-view";
import { CaseHeader } from "./components/case-header";
import { EvidencePanel } from "./components/evidence-panel";
import { MeetingsPanel } from "./components/meetings-panel";
import { CertifyPanel } from "./components/certify-panel";
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
  const v = useCoordinatorCaseView(caseId);
  if (v.detailQuery.isPending) {
    return (
      <section className={styles.page} aria-label="Case file">
        <BackButton />
        <CoordinatorCaseSkeleton />
      </section>
    );
  }
  if (v.detailQuery.isError || !v.detailQuery.data || !v.caseData) {
    return (
      <section className={styles.page} aria-label="Case file">
        <BackButton />
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            We couldn&apos;t load this case file.{" "}
            {apiErrorMessage(v.detailQuery.error)}
          </p>
          <Button
            size="sm"
            variant="outline"
            className={styles.contrastBtn}
            disabled={v.detailQuery.isRefetching}
            onClick={() => v.detailQuery.refetch()}
          >
            {v.detailQuery.isRefetching ? (
              <Loader2 style={{ width: "1rem", height: "1rem" }} aria-hidden="true" />
            ) : null}
            {v.detailQuery.isRefetching ? "Loading…" : "Try again"}
          </Button>
        </div>
      </section>
    );
  }
  const d = v.caseData;
  const activeStep = v.activeStep;
  return (
    <section className={styles.page} aria-label={`Case file for ${d.student}`}>
      <BackButton />
      <CaseHeader
        d={d}
        caseStatus={v.caseStatus}
        hasAttendedMeeting={v.hasAttendedMeeting}
        createPending={v.createMutation.isPending}
        preparingProfile={v.preparingProfile}
        onCreateProfile={(cd) => void v.startCreateProfile(cd)}
        certContext={v.certContext}
        profileCertifiable={v.profileCertifiable}
        onOpenCert={() => v.setCertSheetOpen(true)}
        activeTab={v.activeTab}
        stepDone={v.stepDone}
        onGoStep={v.goStep}
      />
      <div className={styles.wizardLayout}>
        <div className={styles.wizardMain}>
          <div className={styles.instructCard} aria-live="polite">
            <span className={styles.glowClip} aria-hidden="true">
              <span className={styles.cardGlow} />
            </span>
            <div className={styles.instructHead}>
              <p className={styles.instructKicker}>
                Step {v.activeStepIdx + 1} of {CASE_STEPS.length} · {activeStep.label}
                {v.stepDone[activeStep.id] ? " · Done" : ""}
              </p>
              <div className={styles.carouselNav}>
                <Button size="icon" variant="outline" className={styles.carouselBtn} disabled={v.activeStepIdx <= 0} onClick={() => v.goStep(CASE_STEPS[v.activeStepIdx - 1].id)} aria-label="Previous step">
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <Button size="icon" variant="outline" className={styles.carouselBtn} disabled={v.activeStepIdx >= CASE_STEPS.length - 1} onClick={() => v.goStep(CASE_STEPS[v.activeStepIdx + 1].id)} aria-label="Next step">
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </div>
            <dl className={styles.instructList}>
              <div className={styles.instructRow}><dt>What</dt><dd>{activeStep.what}</dd></div>
              <div className={styles.instructRow}><dt>Why</dt><dd>{activeStep.why}</dd></div>
              <div className={styles.instructRow}><dt>Next</dt><dd>{activeStep.action}</dd></div>
            </dl>
          </div>
          <div role="tabpanel" id={`case-panel-${v.activeTab}`} aria-labelledby={`case-tab-${v.activeTab}`}>
            {v.activeTab === "referral" || v.activeTab === "anecdotal" || v.activeTab === "evidence" ? (
              <EvidencePanel d={d} activeTab={v.activeTab} referral={v.referral} anecdotal={v.anecdotal} anecdotalLocked={v.anecdotalLocked} gcLoading={v.gcLoading} hasAttendedMeeting={v.hasAttendedMeeting} onOpenGcForm={() => void v.openGcForm()} onOpenAnecdotal={(id) => v.setAnecdotalPreviewId(id)} onOpenEndorsedNotice={() => v.setEndorsedNoticeOpen(true)} onSeeDetails={(f) => v.seeEvidenceDetails(f)} />
            ) : null}
            {v.activeTab === "meetings" ? (
              <MeetingsPanel orderedMeetings={v.orderedMeetings} latestMeetingId={v.latestMeetingId} now={v.now} meetingIdx={v.meetingIdx} onMeetingIdx={(i) => v.setMeetingIdx(i)} onChanged={() => { void v.detailQuery.refetch(); }} onAttendedConfirmed={v.handleAttendedConfirmed} />
            ) : null}
            {v.activeTab === "certify" ? (
              <CertifyPanel d={d} hasCertification={v.hasCertification} hasAttendedMeeting={v.hasAttendedMeeting} profileCertifiable={v.profileCertifiable} createPending={v.createMutation.isPending} preparingProfile={v.preparingProfile} onCreateProfile={(cd) => void v.startCreateProfile(cd)} onOpenCert={() => v.setCertSheetOpen(true)} />
            ) : null}
          </div>
        </div>
        <div className={styles.wizardSide}>
          <EligibilityChecklistCard checklist={v.checklist} eligibilityStatus={d.eligibilityStatus} stepIndex={v.activeStepIdx} stepTotal={CASE_STEPS.length} onPrevStep={v.activeStepIdx > 0 ? () => v.goStep(CASE_STEPS[v.activeStepIdx - 1].id) : undefined} onNextStep={v.activeStepIdx < CASE_STEPS.length - 1 ? () => v.goStep(CASE_STEPS[v.activeStepIdx + 1].id) : undefined} />
        </div>
      </div>
      <OcForm01PreviewDialog recordId={v.anecdotalPreviewId} onClose={() => v.setAnecdotalPreviewId(null)} />
      <CardModal open={v.endorsedNoticeOpen} onClose={() => v.setEndorsedNoticeOpen(false)} title="Case endorsed" description="This case is endorsed to the Principal and locked awaiting signature." size="sm">
        <p className={styles.muted} style={{ margin: 0 }}>The anecdotal report can&apos;t be opened until the Principal signs or returns the case.</p>
        <div className={styles.modalActions}>
          <Button type="button" onClick={() => v.setEndorsedNoticeOpen(false)}>Understood</Button>
        </div>
      </CardModal>
      <CoordinatorReferralsCreateDialog target={v.createTarget} scopeLabel={v.scopeLabel} onClose={() => v.setCreateTarget(null)} onConfirm={() => v.createMutation.mutate()} pending={v.createMutation.isPending} canConfirm={Boolean(v.termId) && !v.createMutation.isPending} />
      <CertificationSheet open={v.certSheetOpen} context={v.certContext} onClose={() => v.setCertSheetOpen(false)} onCertified={() => { void v.detailQuery.refetch(); }} />
      <ForwardToPrincipalGate caseData={v.detailQuery.data ?? null} onForwarded={() => { void v.detailQuery.refetch(); }} />
      <EvidenceDetailsDialog target={v.evidenceTarget} meetings={v.orderedMeetings} certificationDetails={d.certificationDetails} onClose={() => v.setEvidenceTarget(null)} />
      {v.gcOpen && v.gcData ? (
        <GcForm03PreviewDialog open data={v.gcData} confirming={false} onClose={() => v.setGcOpen(false)} onConfirm={() => {}} viewOnly />
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
