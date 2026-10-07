"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import styles from "./HonorRollHero.module.css";

interface Props {
  data: { schoolYear: string };
  candidateCount: number;
}

/* Demoted content strip — the page header lives above in
   PrincipalPageHeader. No h1 here (single h1 per page). */
export function HonorRollHero({ data, candidateCount }: Props) {
  return (
    <Card className={styles.bannerCardBox}>
      <div className={styles.bannerImage} aria-hidden />
      <div className={styles.bannerCard}>
        <span className={styles.bannerBadge}>{data.schoolYear}</span>
        <div className={styles.bannerRow}>
          <p className={styles.criteria}>
            DO 15, s. 2026 Academic Excellence — live general average ≥ 90, no subject below 80
          </p>
          <span className={styles.countWrap}>
            <Trophy className={styles.squareIcon} aria-hidden />
            <span className={styles.squareValue}>{candidateCount}</span>
            <span className={styles.squareHint}>meet award criteria</span>
          </span>
        </div>
      </div>
    </Card>
  );
}
