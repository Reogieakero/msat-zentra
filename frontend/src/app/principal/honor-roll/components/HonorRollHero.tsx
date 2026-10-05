"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import styles from "./HonorRollHero.module.css";

interface Props {
  data: { schoolYear: string };
  candidateCount: number;
}

export function HonorRollHero({ data, candidateCount }: Props) {
  return (
    <div className={styles.bannerRow}>
      <Card className={`${styles.bannerCardBox} ${styles.bannerCardMain}`}>
        <div className={styles.bannerImage} aria-hidden />
        <div className={styles.bannerCard}>
          <span className={styles.bannerBadge}>{data.schoolYear}</span>
          <h1 className={styles.title}>Honor Roll &amp; Awards</h1>
          <p className={styles.subtitle}>
            DO 15, s. 2026 Academic Excellence — average ≥ 90, no grade below 80
          </p>
        </div>
      </Card>

      <Card className={`${styles.bannerCardBox} ${styles.bannerCardSquare}`}>
        <div className={styles.bannerCard}>
          <Trophy className={styles.squareIcon} aria-hidden />
          <span className={styles.squareLabel}>Awardees</span>
          <span className={styles.squareValue}>{candidateCount}</span>
          <span className={styles.squareHint}>meet award criteria</span>
        </div>
      </Card>

    </div>
  );
}
