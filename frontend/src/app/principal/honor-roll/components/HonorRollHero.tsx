"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Award, Trophy, Users } from "lucide-react";
import type { AwardCategory } from "../honor-roll-data";
import styles from "./HonorRollHero.module.css";

interface Props {
  data: { termLabel: string; schoolYear: string; awards: AwardCategory[] };
  candidateCount: number;
  highestCount: number;
}

export function HonorRollHero({ data, candidateCount, highestCount }: Props) {
  return (
    <div className={styles.bannerRow}>
      <Card className={`${styles.bannerCardBox} ${styles.bannerCardMain}`}>
        <div className={styles.bannerImage} aria-hidden />
        <div className={styles.bannerCard}>
          <span className={styles.bannerBadge}>{data.schoolYear}</span>
          <h1 className={styles.title}>Honor Roll &amp; Awards</h1>
          <p className={styles.subtitle}>
            {data.termLabel} · DepEd recognition bands — average ≥ 90, no grade below 75
          </p>
        </div>
      </Card>

      <Card className={`${styles.bannerCardBox} ${styles.bannerCardSquare}`}>
        <div className={styles.bannerCard}>
          <Trophy className={styles.squareIcon} aria-hidden />
          <span className={styles.squareLabel}>Candidates</span>
          <span className={styles.squareValue}>{candidateCount}</span>
          <span className={styles.squareHint}>meet honor criteria</span>
        </div>
      </Card>

      <Card className={`${styles.bannerCardBox} ${styles.bannerCardSquare}`}>
        <div className={styles.bannerCard}>
          <Award className={styles.squareIcon} aria-hidden />
          <span className={styles.squareLabel}>Highest Honors</span>
          <span className={styles.squareValue}>{highestCount}</span>
          <span className={styles.squareHint}>avg ≥ 98</span>
        </div>
      </Card>

      <Card className={`${styles.bannerCardBox} ${styles.bannerCardSquare}`}>
        <div className={styles.bannerCard}>
          <Users className={styles.squareIcon} aria-hidden />
          <span className={styles.squareLabel}>Award Categories</span>
          <span className={styles.squareValue}>{data.awards.length}</span>
          <span className={styles.squareHint}>school-defined</span>
        </div>
      </Card>
    </div>
  );
}
