"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, TrendingUp, TriangleAlert, Users } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
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

const SHARED_PARAMS = { sharedOnly: true } as const;

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

export function AttendanceSummary() {
  const statsQuery = useQuery({
    queryKey: ["attendance-section-averages", "shared"],
    queryFn: async () => {
      const res = await apiClient.get<{
        sections: SectionStat[];
        trend: TrendPoint[];
        schoolDays: number;
        totalEnrolled: number;
        term?: { id: string; termNumber: number };
      }>("/api/attendance/section-stats", { params: SHARED_PARAMS });
      return res.data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
  const attentionQuery = useQuery({
    queryKey: ["attendance-needs-attention", "shared"],
    queryFn: async () => {
      const res = await apiClient.get<{
        students: unknown[];
      }>("/api/attendance/at-risk-students", { params: SHARED_PARAMS });
      return res.data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
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
    <KanbanBoard
      title="Attendance Overview"
      icon={<Activity size={14} aria-hidden="true" />}
      count={loading ? undefined : sections.length}
      description="School-wide daily attendance — a student counts present for a day only when present in every subject offered that day."
      actions={
        <Pill tone="green" label="Data source">
          Adviser-shared
        </Pill>
      }
      ariaLabel="Attendance overview"
    >
      {loading ? (
        <div className={styles.kpiGrid} aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={styles.kpiSkel} />
          ))}
        </div>
      ) : (
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <span className={styles.kpiTop}>
              <TriangleAlert className={styles.kpiIconBad} size={16} aria-hidden />
              <span className={styles.kpiValue}>{below.toLocaleString()}</span>
            </span>
            <span className={styles.kpiLabel}>Sections below 80%</span>
            <span className={styles.kpiPills}>
              <Pill tone="neutral">
                Of {sections.length.toLocaleString()} sections
              </Pill>
            </span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiTop}>
              <Users className={styles.kpiIconBad} size={16} aria-hidden />
              <span className={styles.kpiValue}>{atRisk.toLocaleString()}</span>
            </span>
            <span className={styles.kpiLabel}>Students below 80%</span>
            <span className={styles.kpiPills}>
              <Pill tone="neutral">Grouped by grade below</Pill>
            </span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiTop}>
              <TrendingUp className={styles.kpiIcon} size={16} aria-hidden />
              <span className={styles.kpiValue}>{directionLabel}</span>
            </span>
            <span className={styles.kpiLabel}>School direction</span>
            <span className={styles.kpiPills}>
              <Pill tone="neutral">Second half vs first half</Pill>
            </span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiTop}>
              <Activity className={styles.kpiIcon} size={16} aria-hidden />
              <span className={styles.kpiValue}>{enrolled.toLocaleString()}</span>
            </span>
            <span className={styles.kpiLabel}>Students enrolled</span>
            <span className={styles.kpiPills}>
              <Pill tone="neutral">Active-term headcount</Pill>
              <Pill tone="green" label="Data source">
                Adviser-shared
              </Pill>
            </span>
          </div>
        </div>
      )}
    </KanbanBoard>
  );
}
