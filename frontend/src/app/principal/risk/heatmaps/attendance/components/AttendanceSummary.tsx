"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, TrendingUp, TriangleAlert, Users } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import styles from "./attendance.module.css";

/** Decorative sprite pinned per metric — same treatment as the overview strip. */
const MASCOTS = ["owl", "bear", "rocket", "knight"] as const;

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
    <div
      className={styles.kpiGrid}
      aria-busy={loading || undefined}
      aria-label="Attendance overview"
    >
      {loading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className={styles.kpiSkel} />
        ))
      ) : (
        <>
          <KanbanBoard
            className={styles.board}
            title="Sections below 80%"
            icon={
              <span className={styles.icon} aria-hidden="true">
                <TriangleAlert size={14} />
              </span>
            }
            ariaLabel="Sections below 80 percent"
          >
            <div className={styles.stat}>
              <span className={styles.statTop}>
                <span className={styles.statNumber}>
                  {below.toLocaleString()}
                </span>
                <span className={styles.statMascot} aria-hidden="true">
                  <StudentMascot
                    name="Sections below 80%"
                    character={MASCOTS[0]}
                    size={36}
                  />
                </span>
              </span>
              <span className={styles.statHint}>Sections under target rate</span>
              <div className={styles.kpiPills}>
                <Pill tone="amber" label="Sections in scope">
                  Of {sections.length.toLocaleString()} sections
                </Pill>
              </div>
            </div>
          </KanbanBoard>

          <KanbanBoard
            className={styles.board}
            title="Students below 80%"
            icon={
              <span className={styles.icon} aria-hidden="true">
                <Users size={14} />
              </span>
            }
            ariaLabel="Students below 80 percent"
          >
            <div className={styles.stat}>
              <span className={styles.statTop}>
                <span className={styles.statNumber}>
                  {atRisk.toLocaleString()}
                </span>
                <span className={styles.statMascot} aria-hidden="true">
                  <StudentMascot
                    name="Students below 80%"
                    character={MASCOTS[1]}
                    size={36}
                  />
                </span>
              </span>
              <span className={styles.statHint}>Learners below target rate</span>
              <div className={styles.kpiPills}>
                <Pill tone="amber" label="Breakdown">
                  Grouped by grade below
                </Pill>
              </div>
            </div>
          </KanbanBoard>

          <KanbanBoard
            className={styles.board}
            title="School direction"
            icon={
              <span className={styles.icon} aria-hidden="true">
                <TrendingUp size={14} />
              </span>
            }
            ariaLabel="School attendance direction"
          >
            <div className={styles.stat}>
              <span className={styles.statTop}>
                <span className={styles.statNumber}>{directionLabel}</span>
                <span className={styles.statMascot} aria-hidden="true">
                  <StudentMascot
                    name="School direction"
                    character={MASCOTS[2]}
                    size={36}
                  />
                </span>
              </span>
              <span className={styles.statHint}>Term-to-date attendance trend</span>
              <div className={styles.kpiPills}>
                <Pill tone="amber" label="Comparison window">
                  Second half vs first half
                </Pill>
              </div>
            </div>
          </KanbanBoard>

          <KanbanBoard
            className={styles.board}
            title="Students enrolled"
            icon={
              <span className={styles.icon} aria-hidden="true">
                <Activity size={14} />
              </span>
            }
            ariaLabel="Students enrolled"
          >
            <div className={styles.stat}>
              <span className={styles.statTop}>
                <span className={styles.statNumber}>
                  {enrolled.toLocaleString()}
                </span>
                <span className={styles.statMascot} aria-hidden="true">
                  <StudentMascot
                    name="Students enrolled"
                    character={MASCOTS[3]}
                    size={36}
                  />
                </span>
              </span>
              <span className={styles.statHint}>Total learners on the roll</span>
              <div className={styles.kpiPills}>
                <Pill tone="amber" label="Scope">
                  Active-term headcount
                </Pill>
                <Pill tone="green" label="Data source">
                  Adviser-shared
                </Pill>
              </div>
            </div>
          </KanbanBoard>
        </>
      )}
    </div>
  );
}
