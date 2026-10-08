"use client";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  admCaseStatusVariant,
  eligibilityLabel,
  stageLabel,
} from "@/services/coordinator/labels";
import type { CoordinatorCaseDetail } from "@/services/coordinator/coordinator.types";
import type { CertSheetContext } from "../certification-sheet";
import { CASE_STEPS, type CaseStepId } from "../case-steps";
import styles from "../case-page.module.css";
export function CaseHeader({
  d,
  caseStatus,
  hasAttendedMeeting,
  createPending,
  preparingProfile,
  onCreateProfile,
  certContext,
  profileCertifiable,
  onOpenCert,
  activeTab,
  stepDone,
  onGoStep,
}: {
  d: CoordinatorCaseDetail;
  caseStatus: { key: string; label: string };
  hasAttendedMeeting: boolean;
  createPending: boolean;
  preparingProfile: boolean;
  onCreateProfile: (d: CoordinatorCaseDetail) => void;
  certContext: CertSheetContext | null;
  profileCertifiable: boolean;
  onOpenCert: () => void;
  activeTab: CaseStepId;
  stepDone: Record<CaseStepId, boolean>;
  onGoStep: (id: CaseStepId) => void;
}) {
  const showCreate =
    d.kind === "referral" &&
    (d.meetings ?? []).some((mtg) => mtg.attended);
  void hasAttendedMeeting;
  return (
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
          {showCreate ? (
            <Button
              disabled={createPending || preparingProfile}
              aria-busy={
                createPending || preparingProfile || undefined
              }
              onClick={() => void onCreateProfile(d)}
            >
              {createPending || preparingProfile ? (
                <Loader2
                  className="animate-spin"
                  aria-hidden="true"
                  style={{ width: "0.875rem", height: "0.875rem" }}
                />
              ) : null}
              {createPending
                ? "Creating…"
                : preparingProfile
                  ? "Preparing…"
                  : "Create learner profile"}
            </Button>
          ) : null}
          {certContext && profileCertifiable && hasAttendedMeeting ? (
            <Button onClick={onOpenCert}>Continue to certification</Button>
          ) : null}
        </div>
      </div>
      <div className={styles.headerDivider} aria-hidden="true" />
      <div className={styles.headerSection}>
        <div className={styles.sideField}>
          <span className={styles.sideFieldLabel}>Stage</span>
          <span className={styles.sideFieldValue}>{stageLabel(d.stage)}</span>
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
            <p className={styles.headerNote}>Approved by {d.approvedBy}</p>
          ) : null}
          {d.approvalDate ? (
            <p className={styles.headerNote}>{d.approvalDate}</p>
          ) : null}
        </div>
      </div>
      <div className={styles.headerDivider} aria-hidden="true" />
      <div
        className={styles.headerSteps}
        role="tablist"
        aria-label="Case file sections"
      >
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
              onClick={() => onGoStep(s.id)}
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
  );
}
