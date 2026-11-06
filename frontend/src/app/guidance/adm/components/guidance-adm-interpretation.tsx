"use client";

import { GuidanceAdmNumberText } from "./guidance-adm-number-text";
import styles from "./guidance-adm-reports.module.css";

/**
 * Interpretation line for a kanban board. Pinned to the bottom of its board
 * so every board in a row shares one baseline, with numeric facts in amber.
 */
export function GuidanceAdmInterpretation({
  children,
}: {
  children: string;
}) {
  return (
    <div className="mt-auto">
      <p className={styles.interpretation} role="status">
        <GuidanceAdmNumberText>{children}</GuidanceAdmNumberText>
      </p>
    </div>
  );
}
