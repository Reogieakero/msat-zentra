"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ADM_STAGES,
  gradeLabel,
  stageOrder,
  stageStatus,
  type AdmCase,
} from "./adm-cases-data";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./AdmCaseDialog.module.css";

interface AdmCaseRailProps {
  caseData: AdmCase;
  onClose: () => void;
  onTrack: (caseData: AdmCase) => void;
}

/* Read-only case tracking in a right-side card: the official 8-stage ADM
   pipeline with the current position plus status-only facts. No clinical
   detail ever renders here. */
export function AdmCaseRail({ caseData, onClose, onTrack }: AdmCaseRailProps) {
  const currentOrder = stageOrder(caseData.stage);

  return (
    <div className={assign.card} aria-label={`Track ADM case for ${caseData.studentName}`}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{caseData.studentName} — tracking</h3>
          <p className="truncate text-xs text-muted-foreground">
            LRN {caseData.lrn} · {caseData.section} · {gradeLabel(caseData.gradeLevel)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close case tracking"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="relative flex items-center gap-2">
        <div
          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round((currentOrder / 8) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Overall pipeline progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.round((currentOrder / 8) * 100)}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          Stage {currentOrder} of 8
        </span>
      </div>

      <ol className={`${styles.track} relative`} aria-label="ADM pipeline progress">
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

      <div className="relative flex justify-end">
        <Button type="button" size="sm" onClick={() => onTrack(caseData)}>
          Track in referrals
        </Button>
      </div>
    </div>
  );
}
