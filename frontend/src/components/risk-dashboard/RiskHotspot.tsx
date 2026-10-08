"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SectionMatrixRow } from "./risk-dashboard-data";
import styles from "./RiskHotspot.module.css";

export interface RiskHotspotData {
  section: string;
  category: string;
  count: number;
  sectionTotal: number;
  deskTotal: number;
}

export function findHotspot(
  matrix: SectionMatrixRow[],
  categories: string[],
  total: number,
): RiskHotspotData | null {
  if (total === 0 || matrix.length === 0) return null;
  let hot = { section: matrix[0].section, category: categories[0] ?? "", count: 0 };
  for (const row of matrix) {
    row.counts.forEach((count, i) => {
      if (count > hot.count) {
        hot = { section: row.section, category: categories[i] ?? "", count };
      }
    });
  }
  if (hot.count === 0) return null;
  const sectionRow = matrix.find((r) => r.section === hot.section);
  return {
    ...hot,
    sectionTotal: sectionRow?.total ?? hot.count,
    deskTotal: total,
  };
}

export function RiskHotspot({ hotspot }: { hotspot: RiskHotspotData | null }) {
  return (
    <Card className={`${styles.card} ${styles.glow}`} aria-label="Busiest spot">
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      <CardHeader className={styles.head}>
        <CardTitle className={styles.title}>Busiest spot</CardTitle>
        <CardDescription className={styles.desc}>
          Where to start check-ins today.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hotspot === null ? (
          <p className={styles.empty}>Nothing here yet — hotspots will appear once cases arrive.</p>
        ) : (
          <>
            <p className={styles.spot}>
              {hotspot.section}
              <span className={styles.spotSub}>
                {hotspot.count} {hotspot.category.toLowerCase()} case
                {hotspot.count === 1 ? "" : "s"}
              </span>
            </p>
            <p className={styles.interpretation} role="status">
              {hotspot.section} has the most {hotspot.category.toLowerCase()} cases (
              {hotspot.count} of {hotspot.sectionTotal} from that section) — start
              check-ins there.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
