"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Crown, Medal, Star, Sprout, Leaf } from "lucide-react";
import type { DescriptorBand, HonorRollCandidate } from "../honor-roll-data";
import styles from "./TierLeaderboard.module.css";

interface Props {
  candidates: HonorRollCandidate[];
}

// DO 15, s. 2026 descriptor bands (Advancing 90+ → Emerging below 65).
const BAND_ICON: Record<DescriptorBand, React.ComponentType<{ className?: string }>> = {
  Advancing: Crown,
  Benchmarking: Medal,
  Connecting: Star,
  Developing: Sprout,
  Emerging: Leaf,
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
    () => [...candidates].sort((a, b) => b.overallAverage - a.overallAverage).slice(0, 6),
    [candidates]
  );

  return (
    <Card className={styles.wrap}>
      <div className={styles.head}>
        <h2 className={styles.title}>Top of the Term</h2>
        <p className={styles.sub}>Ranked by term average across awardees</p>
      </div>

      <ol className={styles.list}>
        {ranked.map((c, i) => {
          const Icon = BAND_ICON[c.band];
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
                <span className={styles.tierText}>{c.band}</span>
              </div>
              <span className={styles.avg}>{c.overallAverage.toFixed(1)}</span>
            </li>
          );
        })}
      </ol>

      <div className={styles.legend}>
        <Badge variant="outline">Advancing ≥ 90</Badge>
        <Badge variant="outline">Benchmarking ≥ 80</Badge>
        <Badge variant="outline">Connecting ≥ 75</Badge>
      </div>
    </Card>
  );
}
