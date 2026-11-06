"use client";

import { InsightCallout } from "@/components/ui/insight-callout";
import { AdmNumberText } from "./NurseAdmNumberText";
import styles from "./nurse-adm.module.css";

/**
 * Interpretation line for a kanban board — the shared insight callout, same
 * shape as the nurse overview's "What it means" footer. Pinned to the bottom
 * of its board (`.footerSlot` owns the flex pin because the callout's own
 * `margin: 0` wins over Tailwind's `mt-auto`), while the numeric facts inside
 * the message render amber and the prose stays muted.
 */
export function AdmInterpretation({ children }: { children: string }) {
  return (
    <div className={styles.footerSlot}>
      <InsightCallout role="status" className={styles.interpretation}>
        <span className={styles.interpretationLabel}>What it means · </span>
        <AdmNumberText>{children}</AdmNumberText>
      </InsightCallout>
    </div>
  );
}
