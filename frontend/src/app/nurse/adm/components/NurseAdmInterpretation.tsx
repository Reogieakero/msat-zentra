"use client";

import { AdmNumberText } from "./NurseAdmNumberText";
import styles from "./nurse-adm.module.css";

/**
 * Interpretation line for a kanban board. Pinned to the bottom of its board
 * (`mt-auto`) so every board in a row shares one baseline, and the numeric
 * facts inside the message render amber while the prose stays muted.
 */
export function AdmInterpretation({ children }: { children: string }) {
  return (
    <div className="mt-auto">
      <p className={styles.interpretation} role="status">
        <AdmNumberText>{children}</AdmNumberText>
      </p>
    </div>
  );
}
