"use client";

import * as React from "react";
import type { HonorRollCandidate, PotentialHonorCandidate } from "../mockData";
import { Skeleton } from "@/components/ui/skeleton";
import { X } from "lucide-react";
import styles from "../academics.module.css";

interface Props {
  title: string;
  candidates: (HonorRollCandidate | PotentialHonorCandidate)[];
  showUnlocked: boolean;
  loading: boolean;
  onClose: () => void;
}

const TIER_RANK: Record<string, number> = {
  "Highest Honors": 3,
  "High Honors": 2,
  "With Honors": 1,
};

export function HonorRollTable({
  title,
  candidates,
  showUnlocked,
  loading,
  onClose,
}: Props) {
  const rows = React.useMemo(
    () =>
      [...candidates].sort((a, b) => {
        const d = (TIER_RANK[b.tier] ?? 0) - (TIER_RANK[a.tier] ?? 0);
        if (d !== 0) return d;
        return b.overallAverage - a.overallAverage;
      }),
    [candidates]
  );

  return (
    <div className={styles.honorWrap}>
      <div className={styles.honorHead}>
        <div>
          <h3 className={styles.honorTitle}>{title}</h3>
          <p className={styles.honorSub}>
            {showUnlocked
              ? "Students whose current grades already meet a DepEd honor band — lock remaining subjects to confirm."
              : "Confirmed honor roll — all subject grades are locked/finalized."}
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
        <p className={styles.empty}>No students in this category yet.</p>
      ) : (
        <table className={styles.honorTable}>
          <thead>
            <tr>
              <th>Student</th>
              <th>Average</th>
              <th>Tier</th>
              {showUnlocked && <th>Unlocked</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.studentId}>
                <td className={styles.honorName}>{c.name}</td>
                <td className={styles.mono}>{c.overallAverage.toFixed(1)}</td>
                <td>
                  <span className={`${styles.tierChip} ${styles[`tier_${c.tier.replace(/\s+/g, "")}`]}`}>
                    {c.tier}
                  </span>
                </td>
                {showUnlocked && (
                  <td className={styles.mono}>
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
