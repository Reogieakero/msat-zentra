"use client";

import { Check } from "lucide-react";
import styles from "./case-page.module.css";

export interface ChecklistInput {
  hasReferral: boolean;
  hasAnecdotal: boolean;
  meetingAttended: boolean;
  hasMinutes: boolean;
  hasHomeVisit: boolean;
  hasCertification: boolean;
}

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

/**
 * Derived eligibility checklist — rendered flat as the body of the
 * eligibility KanbanBoard (the board supplies the title, progress and
 * eligibility badge; the page supplies the derived note).
 */
export function EligibilityChecklistCard({
  checklist,
}: {
  checklist: ReturnType<typeof deriveChecklist>;
}) {
  return (
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
            <span className={styles.checkHint}>{c.hint}</span>
          </span>
          <span
            className={`${styles.checkPill} ${c.ok ? styles.checkPillGreen : styles.checkPillRed}`}
          >
            {c.ok ? "On file" : "Missing"}
          </span>
        </li>
      ))}
    </ul>
  );
}
