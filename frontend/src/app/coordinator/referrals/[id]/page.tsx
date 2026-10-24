"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarClock,
  ChevronLeft,
  ClipboardList,
  FileText,
  Files,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { KanbanOverlay, KanbanPill } from "@/components/ui/kanban-overlay";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { useDock } from "@/components/dock/dock-store";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { GcForm03PreviewDialog } from "@/app/guidance/adm/components/GcForm03PreviewDialog";
import { CoordinatorReferralsCreateDialog } from "../components/coordinator-referrals-create-dialog";
import { CoordinatorReferralsForwardDialog } from "../components/coordinator-referrals-confirm-dialogs";
import { CoordinatorReferralsBookDialog } from "../components/coordinator-referrals-book-dialog";
import { CertificationSheet } from "./certification-sheet";
import { EvidenceDetailsDialog } from "./evidence-details-dialog";
import { apiClient } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { markSelfNotified } from "@/lib/realtime/coordinatorChannel";
import { toast } from "@/components/ui/sonner";
import { CoordinatorCaseSkeleton } from "./coordinator-case-skeleton";
import { EligibilityChecklistCard } from "./eligibility-checklist-card";
import { CASE_STEPS, type CaseStepId } from "./case-steps";
import type { CoordinatorCaseDetail } from "@/services/coordinator/coordinator.types";
import {
  eligibilityLabel,
  stageLabel,
} from "@/services/coordinator/labels";
import { useCoordinatorCaseView } from "./components/use-coordinator-case-view";
import { EvidencePanel } from "./components/evidence-panel";
import { MeetingsPanel } from "./components/meetings-panel";
import { CertifyPanel } from "./components/certify-panel";
import styles from "./case-page.module.css";

/** Board columns split across rows: Referral/Anecdotal/Meetings on top,
 *  Evidence/Certify below (so they aren't cramped in the first row). */
const BOARD_ROWS: CaseStepId[][] = [
  ["referral", "anecdotal", "meetings"],
  ["evidence", "certify"],
];

/** Left icon per column header (a step glyph, never a check mark). */
const STEP_ICONS: Record<CaseStepId, LucideIcon> = {
  referral: FileText,
  anecdotal: ClipboardList,
  meetings: CalendarClock,
  evidence: Files,
  certify: BadgeCheck,
};
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
  const dock = useDock();
  const [forwardOpen, setForwardOpen] = React.useState(false);
  const forwardMutation = useMutation({
    mutationFn: async ({
      profileId,
    }: {
      profileId: string;
      student: string;
      taskId: string | null;
    }) => {
      const { data } = await apiClient.patch(`/api/adm/${profileId}/stage`, {
        stage: "principal_approval",
      });
      return data;
    },
    onSuccess: (data, vars) => {
      void data;
      markSelfNotified(vars.profileId);
      void queryClient.invalidateQueries({ queryKey: ["coordinator-referrals"] });
      void queryClient.invalidateQueries({ queryKey: ["coordinator-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["coordinator-notifications"] });
      if (vars.taskId) {
        dock.completeTask(vars.taskId, `${vars.student} → Principal`);
      }
      onForwarded();
    },
    onError: (err, vars) => {
      if (vars.taskId) dock.failTask(vars.taskId, apiErrorMessage(err));
      toast.error({
        title: "Could not endorse case",
        description: apiErrorMessage(err),
      });
    },
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
      target={
        forwardOpen && caseData
          ? {
              student: caseData.student,
              lrn: caseData.lrn,
              grade: caseData.grade,
            }
          : null
      }
      onClose={() => setForwardOpen(false)}
      onConfirm={() => {
        if (!caseData?.profileId || forwardMutation.isPending) return;
        const profileId = caseData.profileId;
        const student = caseData.student;
        // Close at once — the shared Dock reports the request until it settles.
        setForwardOpen(false);
        let taskId: string | null = null;
        try {
          taskId = dock.startTask({
            kind: "adm-endorse",
            title: "Endorsing to Principal",
            description: `${student} → Principal`,
          });
        } catch {
          taskId = null;
        }
        forwardMutation.mutate({ profileId, student, taskId });
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
  const showCreate =
    d.kind === "referral" && (d.meetings ?? []).some((m) => m.attended);
  const showCert =
    v.certContext !== null && v.profileCertifiable && v.hasAttendedMeeting;
  const headerActions = (
    <>
      {showCreate ? (
        <Button
          size="sm"
          disabled={v.createMutation.isPending || v.preparingProfile}
          aria-busy={v.createMutation.isPending || v.preparingProfile || undefined}
          onClick={() => void v.startCreateProfile(d)}
        >
          {v.createMutation.isPending || v.preparingProfile ? (
            <Loader2
              className="animate-spin"
              aria-hidden="true"
              style={{ width: "0.875rem", height: "0.875rem" }}
            />
          ) : null}
          {v.createMutation.isPending
            ? "Creating…"
            : v.preparingProfile
              ? "Preparing…"
              : "Create learner profile"}
        </Button>
      ) : null}
      {showCert ? (
        <Button size="sm" onClick={() => v.setCertSheetOpen(true)}>
          Continue to certification
        </Button>
      ) : null}
    </>
  );
  const stepContent = (id: CaseStepId) => {
    if (id === "referral" || id === "anecdotal" || id === "evidence") {
      return (
        <EvidencePanel d={d} activeTab={id} referral={v.referral} anecdotal={v.anecdotal} anecdotalLocked={v.anecdotalLocked} gcLoading={v.gcLoading} hasAttendedMeeting={v.hasAttendedMeeting} onOpenGcForm={() => void v.openGcForm()} onOpenAnecdotal={(aid) => v.setAnecdotalPreviewId(aid)} onOpenEndorsedNotice={() => v.setEndorsedNoticeOpen(true)} onSeeDetails={(f) => v.seeEvidenceDetails(f)} />
      );
    }
    if (id === "meetings") {
      return (
        <MeetingsPanel orderedMeetings={v.orderedMeetings} latestMeetingId={v.latestMeetingId} now={v.now} meetingIdx={v.meetingIdx} onMeetingIdx={(idx) => v.setMeetingIdx(idx)} onChanged={() => { void v.detailQuery.refetch(); }} onAttendedConfirmed={v.handleAttendedConfirmed} onBook={v.booking.openBook} />
      );
    }
    if (id === "certify") {
      return (
        <CertifyPanel d={d} hasCertification={v.hasCertification} hasAttendedMeeting={v.hasAttendedMeeting} profileCertifiable={v.profileCertifiable} createPending={v.createMutation.isPending} preparingProfile={v.preparingProfile} onCreateProfile={(cd) => void v.startCreateProfile(cd)} onOpenCert={() => v.setCertSheetOpen(true)} />
      );
    }
    return null;
  };
  return (
    <section className={styles.page} aria-label={`Case file for ${d.student}`}>
      <BackButton />
      <KanbanBoard
        title={
          <span className={styles.boardTitle}>
            <span className={styles.boardTitleName}>{d.student}</span>
            <span className={styles.boardTitlePills}>
              <span className={styles.pill}>{d.lrn}</span>
              {d.grade ? <span className={styles.pill}>{d.grade}</span> : null}
            </span>
          </span>
        }
        icon={<StudentMascot name={d.student} seed={d.lrn} size={28} />}
        ariaLabel={`Case file for ${d.student}`}
        boardLabel="Case workflow board"
        actions={
          <>
            <span className={styles.pill}>{stageLabel(d.stage)}</span>
            <span className={styles.pill}>
              Referred by {d.preparedBy || "—"}
            </span>
            {headerActions}
          </>
        }
      >
        <div className={styles.boardRows} role="list" aria-label="Case workflow columns">
          {BOARD_ROWS.map((row, ri) => (
            <div key={ri} className={styles.boardRow} role="presentation">
              {row.map((id) => {
                const s =
                  CASE_STEPS.find((x) => x.id === id) ?? CASE_STEPS[0];
                const done = v.stepDone[s.id];
                const StepIcon = STEP_ICONS[s.id];
                return (
                  <div key={s.id} className={styles.column} role="listitem">
                    <KanbanBoard
                      title={s.short}
                      icon={
                        <span
                          className={styles.columnDot}
                          data-done={done ? "true" : "false"}
                          aria-hidden="true"
                        >
                          <StepIcon size={14} />
                        </span>
                      }
                      description={s.what}
                      ariaLabel={`${s.short}${done ? ", done" : ""}`}
                      className={styles.columnInner}
                    >
                      {stepContent(s.id)}
                    </KanbanBoard>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </KanbanBoard>
      <KanbanBoard
        title="Eligibility checklist"
        description={`${v.checklist.filter((c) => c.ok).length} of ${v.checklist.length} complete`}
        actions={
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
        }
        footer={
          <p className={styles.checklistNote}>
            Eligibility is derived from the checklist — it cannot be typed
            manually.
          </p>
        }
      >
        <EligibilityChecklistCard checklist={v.checklist} />
      </KanbanBoard>
      <OcForm01PreviewDialog recordId={v.anecdotalPreviewId} onClose={() => v.setAnecdotalPreviewId(null)} />
      <KanbanOverlay
        open={v.endorsedNoticeOpen}
        onClose={() => v.setEndorsedNoticeOpen(false)}
        title="Case endorsed"
        icon={<span className="text-primary" aria-hidden><BadgeCheck size={14} /></span>}
        description="This case is endorsed to the Principal and locked awaiting signature."
        headerActions={<KanbanPill tone="accent">Awaiting signature</KanbanPill>}
        footer={
          <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
            <Button
              type="button"
              size="sm"
              className="h-6 px-3 text-xs"
              onClick={() => v.setEndorsedNoticeOpen(false)}
              autoFocus
            >
              Understood
            </Button>
          </div>
        }
      >
        <p className={styles.muted} style={{ margin: "0 0.25rem" }}>
          The anecdotal report can&apos;t be opened until the Principal signs or
          returns the case.
        </p>
      </KanbanOverlay>
      <CoordinatorReferralsCreateDialog target={v.createTarget} scopeLabel={v.scopeLabel} onClose={() => v.setCreateTarget(null)} onConfirm={v.confirmCreate} />
      <CertificationSheet open={v.certSheetOpen} context={v.certContext} onClose={() => v.setCertSheetOpen(false)} onCertified={() => { void v.detailQuery.refetch(); }} />
      <ForwardToPrincipalGate caseData={v.detailQuery.data ?? null} onForwarded={() => { void v.detailQuery.refetch(); }} />
      <EvidenceDetailsDialog target={v.evidenceTarget} meetings={v.orderedMeetings} certificationDetails={d.certificationDetails} onClose={() => v.setEvidenceTarget(null)} />
      <CoordinatorReferralsBookDialog
        open={v.booking.bookOpen}
        selected={v.booking.bookTarget ?? v.bookingRow}
        rescheduleMeeting={v.booking.rescheduleMeeting}
        venuePreset={v.booking.bookVenuePreset}
        pending={v.booking.bookPending}
        serverError={v.booking.bookError}
        onClose={v.booking.closeBook}
        onSubmit={(fields) => v.booking.confirmBook(fields)}
      />
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
