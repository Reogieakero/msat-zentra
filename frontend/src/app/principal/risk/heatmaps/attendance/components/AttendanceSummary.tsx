"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, TrendingUp, TriangleAlert, Users } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./attendance.module.css";

interface SectionStat {
  sectionId: string;
  rate: number;
}

interface TrendPoint {
  date: string;
  rate: number;
}

function trendDirection(points: TrendPoint[]): "up" | "down" | "flat" {
  if (points.length < 4) return "flat";
  const rates = points.map((p) => p.rate);
  const half = Math.floor(rates.length / 2);
  const first = rates.slice(0, half).reduce((a, r) => a + r, 0) / half;
  const second =
    rates.slice(half).reduce((a, r) => a + r, 0) / (rates.length - half);
  const diff = second - first;
  if (diff > 2) return "up";
  if (diff < -2) return "down";
  return "flat";
}

/** Page header + KPI strip. Queries share cache keys with the views below
 *  (SectionAverages, SchoolTrend), so no extra network is spent — and the
 *  30s poll keeps every number live with no manual refresh. */
export function AttendanceSummary() {
  const statsQuery = useQuery({
    queryKey: ["attendance-section-averages"],
    queryFn: async () => {
      const res = await apiClient.get<{
        sections: SectionStat[];
        trend: TrendPoint[];
        schoolDays: number;
        totalEnrolled: number;
        term?: { id: string; termNumber: number };
      }>("/api/attendance/section-stats");
      return res.data;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const attentionQuery = useQuery({
    queryKey: ["attendance-needs-attention"],
    queryFn: async () => {
      const res = await apiClient.get<{
        students: unknown[];
      }>("/api/attendance/at-risk-students");
      return res.data;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const loading = statsQuery.isPending || attentionQuery.isPending;
  const sections = React.useMemo(
    () => statsQuery.data?.sections ?? [],
    [statsQuery.data]
  );
  const below = sections.filter((s) => s.rate < 80).length;
  const direction = React.useMemo(
    () => trendDirection(statsQuery.data?.trend ?? []),
    [statsQuery.data]
  );
  const atRisk = attentionQuery.data?.students.length ?? 0;
  const enrolled = statsQuery.data?.totalEnrolled ?? 0;

  const directionLabel =
    direction === "up"
      ? "Improving"
      : direction === "down"
        ? "Slipping"
        : "Steady";

  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Attendance Heatmap</h1>
          <p className={styles.subtitle}>
            School-wide daily attendance — a student counts present for a day
            only when present in every subject offered that day. Sections and
            students under 80% need attention.
          </p>
        </div>
      </div>
      {loading ? (
        <div className={styles.kpiGrid} aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={styles.kpiSkel} />
          ))}
        </div>
      ) : (
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <span className={styles.glowClip} aria-hidden="true">
              <span className={styles.cardGlow} />
            </span>
            <span className={styles.kpiTop}>
              <TriangleAlert
                className={styles.kpiIconBad}
                size={16}
                aria-hidden
              />
              <span className={styles.kpiValue}>
                {below.toLocaleString()}
              </span>
            </span>
            <span className={styles.kpiLabel}>Sections below 80%</span>
            <span className={styles.kpiSub}>
              of {sections.length.toLocaleString()} sections
            </span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.glowClip} aria-hidden="true">
              <span className={styles.cardGlow} />
            </span>
            <span className={styles.kpiTop}>
              <Users className={styles.kpiIconBad} size={16} aria-hidden />
              <span className={styles.kpiValue}>{atRisk.toLocaleString()}</span>
            </span>
            <span className={styles.kpiLabel}>Students below 80%</span>
            <span className={styles.kpiSub}>grouped by grade below</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.glowClip} aria-hidden="true">
              <span className={styles.cardGlow} />
            </span>
            <span className={styles.kpiTop}>
              <TrendingUp
                className={styles.kpiIcon}
                size={16}
                aria-hidden
              />
              <span className={styles.kpiValue}>{directionLabel}</span>
            </span>
            <span className={styles.kpiLabel}>School direction</span>
            <span className={styles.kpiSub}>second half vs first half</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.glowClip} aria-hidden="true">
              <span className={styles.cardGlow} />
            </span>
            <span className={styles.kpiTop}>
              <Activity className={styles.kpiIcon} size={16} aria-hidden />
              <span className={styles.kpiValue}>
                {enrolled.toLocaleString()}
              </span>
            </span>
            <span className={styles.kpiLabel}>Students enrolled</span>
            <span className={styles.kpiSub}>
              active-term headcount · roster-aware
            </span>
          </div>
        </div>
      )}
    </>
  );
}
