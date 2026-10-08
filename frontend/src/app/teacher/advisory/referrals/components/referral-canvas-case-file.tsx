"use client";
import { Eye, FileText, Trash2 } from "lucide-react";
import { ReadMore } from "./ReadMore";
import styles from "./ReferralCanvas.module.css";
import type { ReferralData } from "./referral-canvas-types";
export function ReferralCanvasCaseFile({ referral }: { referral: ReferralData }) {
  return (
    <div className={styles.caseFile}>
      <div className={`${styles.caseRow} ${styles.caseSpanReason}`}>
        <span className={styles.caseLabel}>
          <FileText className={styles.caseIcon} aria-hidden />
          Reason
        </span>
        <ReadMore text={referral.reason ?? "—"} maxLines={3} className={styles.caseText} />
      </div>
      <div className={`${styles.caseRow} ${styles.caseSpanSource}`}>
        <span className={styles.caseLabel}>
          <Eye className={styles.caseIcon} aria-hidden />
          Source anecdotal
        </span>
        <p className={styles.caseText}>
          <span className={styles.caseDate}>Observed {referral.observationDate ?? "—"}</span>
        </p>
      </div>
      {referral.status === "dismissed" && referral.notes ? (
        <div className={`${styles.caseRow} ${styles.caseSpanFull}`}>
          <span className={styles.caseLabel}>
            <Trash2 className={styles.caseIcon} aria-hidden />
            Cancellation reason
          </span>
          <ReadMore text={referral.notes} maxLines={3} className={styles.caseText} />
        </div>
      ) : null}
    </div>
  );
}
