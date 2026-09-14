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
import { fetchGuidanceOverview } from "./components/guidance-risk-data";
import styles from "../pages.module.css";

/**
 * Guidance risk dashboard — fully live. Reads only guidance-scoped backend
 * endpoints (`/api/guidance/overview`): rule-based risk levels
 * (High = 2+ flags, Moderate = 1, Low = 0), status-only factor totals, the
 * per-section level heatmap, and the grade attention table. No mock data,
 * no confidential write-ups, no principal-only aggregates.
 */
export default function GuidanceRiskPage() {
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ["guidance-risk-board"],
    queryFn: () => fetchGuidanceOverview(),
    staleTime: 60_000,
  });

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Insights · School-wide</p>
            <h1 className={styles.title}>Risk dashboard</h1>
            <p className={styles.lede}>Loading live risk levels…</p>
          </div>
        </div>
        <div className={styles.kpiGrid} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className={styles.card}>
              <CardContent>
                <Skeleton style={{ width: "60%", height: "0.85rem" }} />
                <Skeleton
                  style={{ width: "40%", height: "1.75rem", marginTop: "0.5rem" }}
                />
                <Skeleton
                  style={{ width: "80%", height: "0.8rem", marginTop: "0.5rem" }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Section heatmap mirror — heat cells. */}
        <Card className={styles.card} aria-hidden="true">
          <CardHeader>
            <Skeleton style={{ width: "14rem", height: "1rem" }} />
            <Skeleton style={{ width: "20rem", maxWidth: "100%", height: "0.8rem", marginTop: "0.375rem" }} />
          </CardHeader>
          <CardContent>
            <div className={styles.heatGrid}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className={styles.heatCell}>
                  <Skeleton style={{ width: "60%", height: "0.85rem" }} />
                  <Skeleton style={{ width: "100%", height: "2.5rem", marginTop: "0.5rem" }} />
                  <Skeleton style={{ width: "80%", height: "0.75rem", marginTop: "0.5rem" }} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        {/* Grade attention table mirror. */}
        <Card className={styles.card} aria-hidden="true">
          <CardHeader>
            <Skeleton style={{ width: "10rem", height: "1rem" }} />
            <Skeleton style={{ width: "18rem", maxWidth: "100%", height: "0.8rem", marginTop: "0.375rem" }} />
          </CardHeader>
          <CardContent>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} style={{ width: "100%", height: "2.25rem", marginTop: i === 0 ? 0 : "0.375rem" }} />
            ))}
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
            <p className={styles.eyebrow}>Insights · School-wide</p>
            <h1 className={styles.title}>Risk dashboard</h1>
          </div>
        </div>
        <Card className={styles.card}>
          <CardHeader>
            <CardTitle className={styles.sectionTitle}>
              We couldn&apos;t load the risk board
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

  const { high, moderate, low } = data.riskByLevel;
  const flagged = high + moderate;
  const activeFlags =
    data.factorTotals.attendance +
    data.factorTotals.grades +
    data.factorTotals.behavior;

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Insights · School-wide</p>
          <h1 className={styles.title}>Risk dashboard</h1>
          <p className={styles.lede}>
            Live rule-based risk scores (High ≥ 2 flags, Moderate = 1, Low =
            0) and section heatmap for {data.termLabel}. Status-only counts —
            detail views live under Heatmap and Behavioral.
          </p>
        </div>
        <Badge variant="outline">Live · {data.termLabel}</Badge>
      </div>

      <div className={styles.actions}>
        <Button asChild size="sm" variant="outline">
          <Link href="/guidance/risk/heatmap">Heatmap detail</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/guidance/risk/behavioral">Behavioral records</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/guidance/alerts">At-risk queue</Link>
        </Button>
      </div>

      <div className={styles.kpiGrid}>
        <Card className={styles.card}>
          <CardContent>
            <p className={styles.kpiLabel}>High-risk students</p>
            <p className={styles.kpiValue}>{high}</p>
            <p className={styles.kpiHint}>2 or more flags this term</p>
          </CardContent>
        </Card>
        <Card className={styles.card}>
          <CardContent>
            <p className={styles.kpiLabel}>Moderate-risk students</p>
            <p className={styles.kpiValue}>{moderate}</p>
            <p className={styles.kpiHint}>Exactly 1 flag this term</p>
          </CardContent>
        </Card>
        <Card className={styles.card}>
          <CardContent>
            <p className={styles.kpiLabel}>Low-risk students</p>
            <p className={styles.kpiValue}>{low}</p>
            <p className={styles.kpiHint}>No flags this term</p>
          </CardContent>
        </Card>
        <Card className={styles.card}>
          <CardContent>
            <p className={styles.kpiLabel}>Active flags</p>
            <p className={styles.kpiValue}>{activeFlags}</p>
            <p className={styles.kpiHint}>
              Academic {data.factorTotals.grades} · Attendance{" "}
              {data.factorTotals.attendance} · Behavioral{" "}
              {data.factorTotals.behavior}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>
            Section heatmap ({data.termLabel})
          </CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Darker bar = more High-risk students in that section.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.sectionHeat.length === 0 ? (
            <p className={styles.sectionDesc}>
              No sections enrolled for the active school year yet.
            </p>
          ) : (
            <div className={styles.heatGrid}>
              {data.sectionHeat.map((cell) => (
                <div
                  key={cell.section}
                  className={styles.heatCell}
                  title={`${cell.section} · ${cell.grade}`}
                >
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
          )}
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>
            Grade attention
          </CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Where flagged students concentrate, and which section leads each
            grade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Sections</th>
                  <th>High</th>
                  <th>At-risk</th>
                  <th>Highest section</th>
                </tr>
              </thead>
              <tbody>
                {data.gradeAttention.map((row) => (
                  <tr key={row.short}>
                    <td className={styles.mono}>{row.grade}</td>
                    <td>{row.sections}</td>
                    <td>{row.high}</td>
                    <td>{row.atRisk}</td>
                    <td>
                      {flagged === 0 && row.atRisk === 0 ? (
                        "—"
                      ) : (
                        <>
                          {row.topSection}{" "}
                          <span className={styles.mono}>
                            ({row.topCount} flagged)
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className={styles.note}>
        Levels recompute live per student and term; heatmaps aggregate section
        × risk level without exposing confidential write-ups. The flagged
        caseload itself lives in the at-risk queue.
      </p>
    </section>
  );
}
