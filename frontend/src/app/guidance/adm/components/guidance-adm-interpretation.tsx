"use client";

import { InsightCallout } from "@/components/ui/insight-callout";
import { GuidanceAdmNumberText } from "./guidance-adm-number-text";
import styles from "./guidance-adm-reports.module.css";

/**
 * Interpretation line for a kanban board — the shared insight callout, same
 * shape as the other desks' "What it means" footers. The bottom pin lives on
 * the wrapper (the callout's own `margin: 0` overrides Tailwind's `mt-auto`),
 * while numeric facts inside the message render amber.
 */
export function GuidanceAdmInterpretation({
  children,
}: {
  children: string;
}) {
  return (
    <div className="mt-auto">
      <InsightCallout role="status">
        <span className={styles.interpretationLabel}>What it means · </span>
        <GuidanceAdmNumberText>{children}</GuidanceAdmNumberText>
      </InsightCallout>
    </div>
  );
}
