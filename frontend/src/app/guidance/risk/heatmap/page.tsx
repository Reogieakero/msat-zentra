"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchGuidanceRiskHeatmap } from "../components/guidance-risk-data";
import { GuidanceHeatmapVisual } from "./components/guidance-heatmap-visual";
import { GuidanceSectionCards } from "./components/guidance-section-cards";
import styles from "../../pages.module.css";

/**
 * Guidance heatmap detail — fully live. Level buckets (High / Moderate /
 * Low) come from `/api/guidance/overview` across the full enrolled cohort;
 * factor columns (Academic / Attendance / Behavioral) aggregate the
 * system-flagged at-risk queue (`/api/guidance/alerts`). Cells aggregate
 * counts only — no confidential text is shown at this grain.
 */
export default function GuidanceHeatmapPage() {
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ["guidance-risk-heatmap"],
    queryFn: () => fetchGuidanceRiskHeatmap(),
    staleTime: 60_000,
  });

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Insights · Risk heatmap</p>
            <h1 className={styles.title}>Attendance × academic heatmap</h1>
            <p className={styles.lede}>Loading the live section matrix…</p>
          </div>
          <Skeleton style={{ width: "8rem", height: "1.5rem" }} />
        </div>
        {/* Heatmap matrices mirror — two matrix blocks with cell grids. */}
        <Card className={styles.card} aria-hidden="true">
          <CardHeader>
            <CardTitle className={styles.sectionTitle}>
              <Skeleton style={{ width: "15rem", height: "1rem" }} />
            </CardTitle>
            <CardDescription className={styles.sectionDesc}>
              <Skeleton style={{ width: "24rem", maxWidth: "100%", height: "0.8rem" }} />
            </CardDescription>
          </CardHeader>
          <CardContent>
            {[0, 1].map((block) => (
              <div key={block} style={{ marginBottom: block === 0 ? "1.25rem" : 0 }}>
                <Skeleton style={{ width: "11rem", height: "0.85rem" }} />
                <Skeleton style={{ width: "19rem", maxWidth: "100%", height: "0.75rem", marginTop: "0.375rem" }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.5rem", marginTop: "0.625rem" }}>
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <Skeleton key={i} style={{ width: "100%", height: "2.125rem" }} />
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        {/* Section cards mirror — one card per section. */}
        <Card className={styles.card} aria-hidden="true">
          <CardHeader>
            <CardTitle className={styles.sectionTitle}>
              <Skeleton style={{ width: "8rem", height: "1rem" }} />
            </CardTitle>
            <CardDescription className={styles.sectionDesc}>
              <Skeleton style={{ width: "20rem", maxWidth: "100%", height: "0.8rem" }} />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(17rem, 1fr))", gap: "0.75rem" }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "0.75rem 0.875rem" }}>
                  <Skeleton style={{ width: "55%", height: "0.85rem" }} />
                  <Skeleton style={{ width: "35%", height: "0.75rem", marginTop: "0.375rem" }} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.5rem", marginTop: "0.625rem" }}>
                    {[0, 1, 2].map((j) => (
                      <Skeleton key={j} style={{ width: "100%", height: "2.75rem" }} />
                    ))}
                  </div>
                  <Skeleton style={{ width: "70%", height: "0.75rem", marginTop: "0.625rem" }} />
                  <Skeleton style={{ width: "100%", height: "0.75rem", marginTop: "0.5rem" }} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Insights · Risk heatmap</p>
            <h1 className={styles.title}>Attendance × academic heatmap</h1>
          </div>
        </div>
        <Card className={styles.card}>
          <CardHeader>
            <CardTitle className={styles.sectionTitle}>
              We couldn&apos;t load the heatmap
            </CardTitle>
            <CardDescription className={styles.sectionDesc}>
              Check your connection and try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? "Retrying…" : "Retry"}
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Insights · Risk heatmap</p>
          <h1 className={styles.title}>Attendance × academic heatmap</h1>
          <p className={styles.lede}>
            Live section × risk-factor matrix for {data.termLabel}. Factor
            columns count flagged students; level columns cover the full
            enrolled cohort.
          </p>
        </div>
        <Badge variant="outline">Live · {data.termLabel}</Badge>
      </div>

      <div className={styles.actions}>
        <Button asChild size="sm" variant="outline">
          <Link href="/guidance/risk">Back to risk dashboard</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/guidance/alerts">At-risk queue</Link>
        </Button>
      </div>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>
            Section × risk factor heatmap
          </CardTitle>
          <CardDescription className={styles.sectionDesc}>
            {data.rows.length === 0
              ? "No sections enrolled for the active school year yet."
              : `Academic ${data.totals.academic} · Attendance ${data.totals.attendance} · Behavioral ${data.totals.behavioral} flagged students across ${data.rows.length} section${data.rows.length === 1 ? "" : "s"}. Darker = more students.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.rows.length > 0 ? (
            <GuidanceHeatmapVisual rows={data.rows} totals={data.totals} />
          ) : null}
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>
            Sections
          </CardTitle>
          <CardDescription className={styles.sectionDesc}>
            One card per section — same live data. Follow-ups:{" "}
            {data.totals.followUpOngoing} ongoing · {data.totals.followUpDone}{" "}
            done · {data.totals.followUpNone} not started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.rows.length > 0 ? (
            <GuidanceSectionCards rows={data.rows} />
          ) : null}
        </CardContent>
      </Card>

      <p className={styles.note}>
        {data.truncated
          ? "Very large caseload: factor columns cover the first 1,000 flagged students — level columns are exact. "
          : ""}
        Term-scoped, snapshot-backed aggregates; the flagged caseload itself
        lives in the at-risk queue.
      </p>
    </section>
  );
}
