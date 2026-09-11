"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MOCK_HEATMAP } from "../_mock";
import styles from "../pages.module.css";

export default function GuidanceRiskPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Insights · School-wide</p>
          <h1 className={styles.title}>Risk dashboard</h1>
          <p className={styles.lede}>
            Mock-up only — rule-based risk scores (High ≥ 2 flags, Moderate =
            1, Low = 0) and section heatmap preview. Detail views live under
            Heatmap and Behavioral.
          </p>
        </div>
        <Badge variant="outline" className={styles.mockBadge}>
          Placeholder mock
        </Badge>
      </div>

      <div className={styles.actions}>
        <Button asChild size="sm" variant="outline">
          <Link href="/guidance/risk/heatmap">Heatmap detail</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/guidance/risk/behavioral">Behavioral records</Link>
        </Button>
      </div>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>
            Section heatmap (mock)
          </CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Darker bar = more High-risk students in that section.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={styles.heatGrid}>
            {MOCK_HEATMAP.map((cell) => (
              <div key={cell.section} className={styles.heatCell}>
                <p className={styles.heatSection}>{cell.section}</p>
                <div className={styles.heatBars} aria-hidden>
                  <span
                    className={styles.heatBar}
                    style={{ height: `${cell.high * 10 + 4}px` }}
                  />
                  <span
                    className={`${styles.heatBar} ${styles.heatBarMid}`}
                    style={{ height: `${cell.moderate * 10 + 4}px` }}
                  />
                  <span
                    className={`${styles.heatBar} ${styles.heatBarLow}`}
                    style={{ height: `${Math.min(cell.low * 2 + 4, 40)}px` }}
                  />
                </div>
                <p className={styles.heatLegend}>
                  H {cell.high} · M {cell.moderate} · L {cell.low}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className={styles.note}>
        Future wiring: live recompute per student + term; heatmaps aggregate
        section × risk factor without exposing confidential write-ups.
      </p>
    </section>
  );
}
