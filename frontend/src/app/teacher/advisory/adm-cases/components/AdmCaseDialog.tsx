"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ADM_STAGES,
  ELIGIBILITY_LABELS,
  gradeLabel,
  stageOrder,
  type AdmCase,
} from "./adm-cases-data";
import styles from "./AdmCaseDialog.module.css";

interface AdmCaseDialogProps {
  caseData: AdmCase | null;
  onClose: () => void;
  onTrack: (caseData: AdmCase) => void;
}

function stageStatus(caseData: AdmCase, stage: string): string {
  switch (stage) {
    case "anecdotal":
      return "Filed";
    case "consultation":
      return "Referred";
    case "meeting_parents":
      return caseData.meetingAttended === null
        ? "If needed"
        : caseData.meetingAttended
          ? "Attended"
          : "Scheduled";
    case "home_visitation":
      return caseData.hasHomeVisit ? "Done" : "If no meeting";
    case "certification":
      return caseData.certificationIssued
        ? (ELIGIBILITY_LABELS[caseData.eligibilityStatus] ?? "Issued")
        : "Pending issuance";
    case "principal_approval":
      return caseData.approved ? "Signed" : "Pending signature";
    case "enrollment_monitoring":
      return `Modules ${caseData.modulesSubmitted}/${caseData.modulesTotal}`;
    case "completion":
      return caseData.referralStatus === "resolved" ? "Closed" : "Pending";
    default:
      return "";
  }
}

/**
 * Headline status message in the same voice as the referrals workflow
 * ("done X — now waiting on Y"): what is finished and who the case is
 * waiting on. Status-only, derived from stage + evidence flags.
 */
function caseHeadline(caseData: AdmCase): string {
  if (caseData.referralStatus === "resolved" || caseData.stage === "completion") {
    return "Case closed — the ADM process is complete.";
  }
  switch (caseData.stage) {
    case "anecdotal":
      return "Anecdotal filed — referral is being prepared.";
    case "consultation":
      return "Referral submitted — now waiting for Guidance Counselor / Nurse / LRPC review.";
    case "meeting_parents":
      if (caseData.meetingAttended === true) {
        return "Consultation done — parent meeting attended, moving to Coordinator recommendation.";
      }
      if (caseData.meetingAttended === false) {
        return "Consultation done — parent meeting scheduled, waiting on the ADM Coordinator & Teachers.";
      }
      return "Consultation done — now waiting on the parent meeting.";
    case "home_visitation":
      if (caseData.hasHomeVisit) {
        return "Home visit done — now waiting on Coordinator recommendation & certification.";
      }
      return "Parents did not attend — now waiting on home visitation by the Guidance Counselor.";
    case "certification":
      if (caseData.certificationIssued) {
        return `Certified (${ELIGIBILITY_LABELS[caseData.eligibilityStatus] ?? caseData.eligibilityStatus}) — now waiting for the Principal's signature.`;
      }
      return "Parent engagement done — now waiting for ADM Coordinator recommendation & certification.";
    case "principal_approval":
      if (caseData.approved) {
        return "Principal signed — student is now completing modules under monitoring.";
      }
      if (caseData.eligibilityStatus === "ineligible") {
        return "Not eligible — waiting on the ADM Coordinator to complete the requirements.";
      }
      return "Certification done — now waiting for the Principal's signature.";
    case "enrollment_monitoring":
      return `Approved — now tracking module completion (${caseData.modulesSubmitted}/${caseData.modulesTotal} submitted).`;
    default:
      return "Case is moving through the ADM pipeline.";
  }
}

/**
 * Read-only case detail: the official 8-stage ADM pipeline with the current
 * position plus status-only facts. No clinical detail ever renders here.
 */
export function AdmCaseDialog({ caseData, onClose, onTrack }: AdmCaseDialogProps) {
  const currentOrder = caseData ? stageOrder(caseData.stage) : 0;

  return (
    <Dialog
      open={caseData !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className={styles.dialog}>
        <DialogHeader>
          <DialogTitle>
            {caseData ? `${caseData.studentName} — ADM case` : "ADM case"}
          </DialogTitle>
          <DialogDescription>
            {caseData
              ? `LRN ${caseData.lrn} · ${caseData.section} · ${gradeLabel(caseData.gradeLevel)}`
              : "Case tracking detail."}
          </DialogDescription>
        </DialogHeader>

        {caseData ? (
          <div className={styles.body}>
            <div className={styles.facts}>
              <span className={styles.fact}>
                Stage {currentOrder} of 8 · {caseData.stageLabel}
              </span>
              <Badge variant={caseData.approved ? "success" : "warning"}>
                {caseData.approved ? "Approved" : "Pending approval"}
              </Badge>
              <Badge variant="outline">
                {ELIGIBILITY_LABELS[caseData.eligibilityStatus] ?? caseData.eligibilityStatus}
              </Badge>
            </div>

            <p className={styles.headline} role="status">
              {caseHeadline(caseData)}
            </p>

            <ol className={styles.track} aria-label="ADM pipeline progress">
              {ADM_STAGES.map((step, i) => {
                const done = step.order < currentOrder || caseData.referralStatus === "resolved";
                const active = step.order === currentOrder && caseData.referralStatus !== "resolved";
                const last = i === ADM_STAGES.length - 1;
                return (
                  <li
                    key={step.stage}
                    className={`${styles.step} ${done ? styles.done : ""} ${active ? styles.active : ""}`}
                  >
                    <span className={styles.markerCol} aria-hidden>
                      <span className={styles.marker}>
                        {done ? <Check className={styles.markerIcon} /> : <span>{step.order}</span>}
                      </span>
                      {!last && <span className={styles.connector} />}
                    </span>
                    <span className={styles.stepBody}>
                      <span className={styles.stepLine}>
                        <span className={styles.stepLabel}>{step.label}</span>
                        {step.principalAction && <span className={styles.principalTag}>Principal action</span>}
                        {active && <span className={styles.currentTag}>Current</span>}
                      </span>
                      <span className={styles.stepOwner}>{step.owner}</span>
                      <span className={styles.stepStatus}>{stageStatus(caseData, step.stage)}</span>
                    </span>
                  </li>
                );
              })}
            </ol>

            <dl className={styles.details}>
              <div className={styles.detailRow}>
                <dt>Certification</dt>
                <dd>{caseData.certificationIssued ? "Issued" : "Not yet issued"}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Principal approval</dt>
                <dd>
                  {caseData.approved
                    ? `Signed${caseData.approvedAt ? ` · ${new Date(caseData.approvedAt).toLocaleDateString()}` : ""}`
                    : "Awaiting signature"}
                </dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Devices</dt>
                <dd>
                  {caseData.devicesIssued} issued · {caseData.devicesReturned} returned
                </dd>
              </div>
              {caseData.datePrepared ? (
                <div className={styles.detailRow}>
                  <dt>Date prepared</dt>
                  <dd>{caseData.datePrepared}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          {caseData ? (
            <Button type="button" onClick={() => onTrack(caseData)}>
              Track in referrals
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
