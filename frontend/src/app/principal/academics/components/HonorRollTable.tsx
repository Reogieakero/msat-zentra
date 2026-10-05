"use client";

import * as React from "react";
import type { HonorRollCandidate, PotentialHonorCandidate } from "../academics-data";
import { descriptorBand } from "../academics-data";
import { Skeleton } from "@/components/ui/skeleton";
import { X } from "lucide-react";
import styles from "./HonorRollTable.module.css";
import shared from "../academics.module.css";

interface Props {
  title: string;
  candidates: (HonorRollCandidate | PotentialHonorCandidate)[];
  showUnlocked: boolean;
  loading: boolean;
  onClose: () => void;
}

export function HonorRollTable({
  title,
  candidates,
  showUnlocked,
  loading,
  onClose,
}: Props) {
  // DO 15, s. 2026: awardees listed alphabetically.
  const rows = React.useMemo(
    () => [...candidates].sort((a, b) => a.name.localeCompare(b.name)),
    [candidates]
  );

  return (
    <div className={styles.honorWrap}>
      <div className={styles.honorHead}>
        <div>
          <h3 className={styles.honorTitle}>{title}</h3>
          <p className={styles.honorSub}>
            {showUnlocked
              ? "Students whose current grades already meet the Academic Excellence rule — lock remaining subjects to confirm."
              : "Confirmed Academic Excellence awardees — all subject grades are locked/finalized."}
          </p>
        </div>
        <button
          type="button"
          className={styles.honorClose}
          onClick={onClose}
          aria-label="Close"
        >
          <X className={styles.honorCloseIcon} aria-hidden />
        </button>
      </div>

      {loading ? (
        <div className={styles.honorSkeletonList}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className={styles.honorSkeletonRow} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className={shared.empty}>No students in this category yet.</p>
      ) : (
        <table className={styles.honorTable}>
          <thead>
              <tr>
                <th>Student</th>
                <th>Average</th>
                <th>Band</th>
                {showUnlocked && <th>Unlocked</th>}
              </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.studentId}>
                <td className={styles.honorName}>{c.name}</td>
                <td className={shared.mono}>{c.overallAverage.toFixed(1)}</td>
                <td>
                  <span className={`${styles.tierChip} ${styles.band_Advancing}`}>
                    {descriptorBand(c.overallAverage)}
                  </span>
                </td>
                {showUnlocked && (
                  <td className={shared.mono}>
                    {(c as PotentialHonorCandidate).unlockedSubjects}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
