"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Crown, Medal, Star } from "lucide-react";
import type { HonorRollCandidate, HonorRollTier } from "../honor-roll-data";
import styles from "./TierLeaderboard.module.css";

interface Props {
  candidates: HonorRollCandidate[];
}

const TIER_ICON: Record<HonorRollTier, React.ComponentType<{ className?: string }>> = {
  "Highest Honors": Crown,
  "High Honors": Medal,
  "With Honors": Star,
};

const TIER_RANK: Record<HonorRollTier, number> = {
  "Highest Honors": 3,
  "High Honors": 2,
  "With Honors": 1,
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TierLeaderboard({ candidates }: Props) {
  const ranked = React.useMemo(
    () =>
      [...candidates]
        .sort((a, b) => {
          const d = TIER_RANK[b.tier] - TIER_RANK[a.tier];
          if (d !== 0) return d;
          return b.overallAverage - a.overallAverage;
        })
        .slice(0, 6),
    [candidates]
  );

  return (
    <Card className={styles.wrap}>
      <div className={styles.head}>
        <h2 className={styles.title}>Top of the Term</h2>
        <p className={styles.sub}>Ranked by honor tier, then term average</p>
      </div>

      <ol className={styles.list}>
        {ranked.map((c, i) => {
          const Icon = TIER_ICON[c.tier];
          return (
            <li key={c.studentId} className={styles.row}>
              <span className={`${styles.rank} ${i < 3 ? styles.rankTop : ""}`}>
                {i + 1}
              </span>
              <Avatar size="sm" className={styles.avatar}>
                <AvatarFallback>{initials(c.name)}</AvatarFallback>
              </Avatar>
              <div className={styles.meta}>
                <span className={styles.name}>{c.name}</span>
                <span className={styles.sub}>{c.section}</span>
              </div>
              <div className={styles.tierCol}>
                <Icon className={styles.tierIcon} aria-hidden />
                <span className={styles.tierText}>{c.tier}</span>
              </div>
              <span className={styles.avg}>{c.overallAverage.toFixed(1)}</span>
            </li>
          );
        })}
      </ol>

      <div className={styles.legend}>
        <Badge variant="outline">Highest Honors ≥ 98</Badge>
        <Badge variant="outline">High Honors ≥ 95</Badge>
        <Badge variant="outline">With Honors ≥ 90</Badge>
      </div>
    </Card>
  );
}
