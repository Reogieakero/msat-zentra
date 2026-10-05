"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { eligibilityLabel, type AdmEligibility } from "../../components/coordinator-data";
import styles from "./case-page.module.css";

export interface ChecklistInput {
  hasReferral: boolean;
  hasAnecdotal: boolean;
  meetingAttended: boolean;
  hasMinutes: boolean;
  hasHomeVisit: boolean;
  hasCertification: boolean;
}

/* Mirrors backend evaluateAdmEligibility (backend/src/services/adm.ts):
   referral + anecdotal + certification(verified) + parent engagement
   (meeting attended OR minutes OR home-visit). Pure derivation — the
   coordinator never types eligibility directly. */
export function deriveChecklist(input: ChecklistInput): {
  key: string;
  label: string;
  hint: string;
  ok: boolean;
}[] {
  const parentEngagement =
    input.meetingAttended || input.hasMinutes || input.hasHomeVisit;
  return [
    {
      key: "referral",
      label: "Referral on file",
      hint: "GC Form 03 filed",
      ok: input.hasReferral,
    },
    {
      key: "anecdotal",
      label: "Anecdotal report on file",
      hint: "GCForm-01 filed",
      ok: input.hasAnecdotal,
    },
    {
      key: "engagement",
      label: "Parent engagement",
      hint: "Meeting attended or home visit filed",
      ok: parentEngagement,
    },
    {
      key: "certification",
      label: "ADM certification verified",
      hint: "Recommendation recorded",
      ok: input.hasCertification,
    },
  ];
}

export function EligibilityChecklistCard({
  checklist,
  eligibilityStatus,
  compact,
  stepIndex,
  stepTotal,
  onPrevStep,
  onNextStep,
}: {
  checklist: ReturnType<typeof deriveChecklist>;
  eligibilityStatus: AdmEligibility;
  compact?: boolean;
  /** Optional step carousel — when provided, prev/next chevrons render
      beside the card so steps change from here too. */
  stepIndex?: number;
  stepTotal?: number;
  onPrevStep?: () => void;
  onNextStep?: () => void;
}) {
  const done = checklist.filter((c) => c.ok).length;
  const showStepNav =
    typeof stepIndex === "number" &&
    typeof stepTotal === "number" &&
    stepTotal > 0;
  return (
    <aside
      className={styles.checklistCard}
      aria-label={`Eligibility checklist, ${done} of ${checklist.length} complete`}
    >
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      <div className={styles.checklistHead}>
        <h2 className={styles.cardTitle} style={{ margin: 0 }}>
          Eligibility checklist
        </h2>
        <Badge
          variant={
            eligibilityStatus === "eligible"
              ? "secondary"
              : eligibilityStatus === "ineligible"
                ? "destructive"
                : "outline"
          }
        >
          {eligibilityLabel(eligibilityStatus)}
        </Badge>
      </div>
      <p className={styles.checklistProgress} role="status">
        {done} of {checklist.length} complete
      </p>
      {showStepNav ? (
        <div className={styles.checklistNav}>
          <span className={styles.carouselCount} role="status">
            Step {(stepIndex as number) + 1} of {stepTotal}
          </span>
          <div className={styles.carouselNav}>
            <Button
              size="icon"
              variant="outline"
              className={styles.carouselBtn}
              disabled={!onPrevStep}
              onClick={onPrevStep}
              aria-label="Previous step"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className={styles.carouselBtn}
              disabled={!onNextStep}
              onClick={onNextStep}
              aria-label="Next step"
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
      <ul className={styles.checklist}>
        {checklist.map((c) => (
          <li key={c.key} className={styles.checklistItem}>
            <span
              className={styles.checkDot}
              data-done={c.ok ? "true" : "false"}
              aria-hidden="true"
            >
              {c.ok ? <Check size={12} strokeWidth={3} /> : ""}
            </span>
            <span className={styles.checkText}>
              <span className={styles.checkLabel}>{c.label}</span>
              {!compact ? (
                <span className={styles.checkHint}>{c.hint}</span>
              ) : null}
            </span>
            <Badge variant={c.ok ? "success" : "outline"}>
              {c.ok ? "On file" : "Missing"}
            </Badge>
          </li>
        ))}
      </ul>
      <p className={styles.checklistNote}>
        Eligibility is derived from the checklist — it cannot be typed
        manually.
      </p>
    </aside>
  );
}
