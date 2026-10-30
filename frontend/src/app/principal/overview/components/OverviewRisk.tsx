"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldHalf, GraduationCap } from "lucide-react";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell, Pie, PieChart } from "recharts";
import { PrincipalEmptyState } from "../../components/PrincipalEmptyCard";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { InsightCallout } from "@/components/ui/insight-callout";
import { useTerm } from "@/lib/term/TermContext";
import {
  interpretGradeRisk,
  interpretLevels,
  interpretRisk,
  type FactorKey,
  type FactorRow,
  type LevelKey,
  type LevelRow,
} from "./overview-risk-interpret";
import { fetchOverview } from "@/services/principal/overview.service";
import { FriendlyTooltip } from "./overview-chart-tip";
import { CountUpNumber } from "./CountUpNumber";
import styles from "./OverviewRisk.module.css";

const chartConfig = {
  value: { label: "Students", color: "#f59e0b" },
  count: { label: "Students", color: "#f59e0b" },
} satisfies ChartConfig;

// Amber desk accent — one base hue, stepped down with color-mix so the
// three series read as one family (same recipe as the registry charts).
const AMBER = "#f59e0b";

const FACTOR_COLORS: Record<FactorKey, string> = {
  attendance: AMBER,
  grades: `color-mix(in oklch, ${AMBER} 65%, var(--card))`,
  behavior: `color-mix(in oklch, ${AMBER} 35%, var(--card))`,
};

const LEVEL_COLORS: Record<LevelKey, string> = {
  high: AMBER,
  moderate: `color-mix(in oklch, ${AMBER} 60%, var(--card))`,
  low: `color-mix(in oklch, ${AMBER} 30%, var(--card))`,
};

const GRADE_BAR_FILL = AMBER;

function useOverview() {
  const { activeTerm } = useTerm();
  return useQuery({
    queryKey: ["overview", activeTerm?.termId ?? null],
    queryFn: fetchOverview,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function OverviewRisk() {
  const { data, isPending, isError } = useOverview();

  const rows: FactorRow[] = React.useMemo(() => {
    const atRisk = data?.atRisk;
    if (!atRisk) return [];
    return [
      { key: "attendance", label: "Attendance", value: atRisk.attendance, color: FACTOR_COLORS.attendance },
      { key: "grades", label: "Academics", value: atRisk.grades, color: FACTOR_COLORS.grades },
      { key: "behavior", label: "Behavior", value: atRisk.behavior, color: FACTOR_COLORS.behavior },
    ];
  }, [data]);

  const interpretation = React.useMemo(
    () =>
      data?.atRisk
        ? interpretRisk(
            data.atRisk.attendance,
            data.atRisk.grades,
            data.atRisk.behavior,
            data.atRisk.students,
            data.sharedEnrollment ?? data.kpis.enrollment
          )
        : "",
    [data]
  );

  const riskEmpty = !data || rows.length === 0 || rows.every((r) => r.value === 0) || (data.atRisk?.students ?? 0) === 0;

  const levelRows: LevelRow[] = React.useMemo(() => {
    const levels = data?.riskByLevel;
    if (!levels) return [];
    return [
      { key: "high", label: "High", value: levels.high, color: LEVEL_COLORS.high },
      { key: "moderate", label: "Moderate", value: levels.moderate, color: LEVEL_COLORS.moderate },
      { key: "low", label: "Low", value: levels.low, color: LEVEL_COLORS.low },
    ];
  }, [data]);

  const levelsTotal = levelRows.reduce((sum, r) => sum + r.value, 0);

  const levelInterpretation = React.useMemo(
    () =>
      data?.riskByLevel
        ? interpretLevels(data.riskByLevel.high, data.riskByLevel.moderate, data.riskByLevel.low)
        : "",
    [data]
  );

  const gradeRows = React.useMemo(() => data?.riskByGrade ?? [], [data]);
  const gradeEmpty = !data || gradeRows.length === 0 || gradeRows.every((r) => r.count === 0);
  const levelEmpty = !data || levelRows.length === 0 || levelsTotal === 0;

  const gradeInterpretation = React.useMemo(
    () => (data ? interpretGradeRisk(data.riskByGrade ?? []) : ""),
    [data]
  );

  return (
    <div className={styles.riskGrid}>
      <KanbanBoard
        className="flex-1"
        title="Risk at a glance"
        icon={
          <span className={styles.accent} aria-hidden>
            <ShieldCheck size={14} />
          </span>
        }
        description="Learners flagged by the live risk engine across adviser-shared sections this term."
        actions={
          <Pill tone="green" label="Data source">
            Adviser-shared
          </Pill>
        }
      >
        {isPending ? (
          <Skeleton className={styles.chartSkel} />
        ) : isError ? (
          <p className={styles.empty}>Could not load risk figures.</p>
        ) : riskEmpty ? (
          <PrincipalEmptyState
            icon={ShieldCheck}
            title="No at-risk students this term"
            hint="No students flagged at risk this term. New flags will appear here once detected."
          />
        ) : (
          <>
            <div className={styles.chartWrap}>
              <ChartContainer config={chartConfig} className={styles.chart}>
                <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={6}
                    tick={{ fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} tick={{ fontSize: 11 }} />
                  <ChartTooltip
                    cursor={{ fill: "color-mix(in oklch, #f59e0b, transparent 92%)" }}
                    content={<FriendlyTooltip unit="learners flagged" />}
                  />
                  <Bar
                    dataKey="value"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={44}
                    animationDuration={750}
                    animationEasing="ease-out"
                  >
                    {rows.map((r) => (
                      <Cell key={r.key} style={{ fill: r.color }} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
            <InsightCallout className="mt-auto">{interpretation}</InsightCallout>
          </>
        )}
      </KanbanBoard>

      <KanbanBoard
        className="flex-1"
        title="Students by risk level"
        icon={
          <span className={styles.accent} aria-hidden>
            <ShieldHalf size={14} />
          </span>
        }
        description="Live split of adviser-shared learners by risk level."
        actions={
          <Pill tone="green" label="Data source">
            Adviser-shared
          </Pill>
        }
      >
        {isPending ? (
          <Skeleton className={styles.donutSkel} />
        ) : isError ? (
          <p className={styles.empty}>Could not load risk figures.</p>
        ) : levelEmpty ? (
          <PrincipalEmptyState
            icon={ShieldHalf}
            title="No level data"
            hint="No risk level breakdown available for the active term."
          />
        ) : (
          <>
            <div className={styles.donutWrap}>
              <ChartContainer config={chartConfig} className={styles.donut}>
                <PieChart>
                  <ChartTooltip
                    wrapperStyle={{ zIndex: 50 }}
                    content={
                      <FriendlyTooltip unit="learners tracked" />
                    }
                  />
                  <Pie
                    data={levelRows}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={34}
                    outerRadius={54}
                    paddingAngle={2}
                    strokeWidth={0}
                    animationDuration={850}
                    animationBegin={120}
                    animationEasing="ease-out"
                  >
                    {levelRows.map((entry) => (
                      <Cell key={entry.key} style={{ fill: entry.color }} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className={styles.donutCenter}>
                <CountUpNumber className={styles.donutTotal} value={levelsTotal} />
                <span className={styles.donutLabel}>students</span>
              </div>
            </div>
            <ul className={styles.levelList}>
              {levelRows.map((r) => (
                <li key={r.key} className={styles.levelItem}>
                  <span className={styles.levelLabel}>
                    <span className={styles.levelDot} style={{ backgroundColor: r.color }} aria-hidden />
                    {r.label}
                  </span>
                  <span className={styles.levelCount}>{r.value}</span>
                </li>
              ))}
            </ul>
            <InsightCallout className="mt-auto">{levelInterpretation}</InsightCallout>
          </>
        )}
      </KanbanBoard>

      <KanbanBoard
        className="flex-1"
        title="At-risk students by grade"
        icon={
          <span className={styles.accent} aria-hidden>
            <GraduationCap size={14} />
          </span>
        }
        description="Where adviser-shared flagged learners sit across grade levels this term."
        actions={
          <Pill tone="green" label="Data source">
            Adviser-shared
          </Pill>
        }
      >
        {isPending ? (
          <Skeleton className={styles.chartSkel} />
        ) : isError ? (
          <p className={styles.empty}>Could not load risk figures.</p>
        ) : gradeEmpty ? (
          <PrincipalEmptyState
            icon={GraduationCap}
            title="No at-risk students by grade"
            hint="No at-risk students by grade this term. Grade breakdowns will appear here once detected."
          />
        ) : (
          <>
            <div className={styles.chartWrap}>
              <ChartContainer config={chartConfig} className={styles.chart}>
                <BarChart data={gradeRows} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="grade"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={6}
                    tick={{ fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} tick={{ fontSize: 11 }} />
                  <ChartTooltip
                    cursor={{ fill: "color-mix(in oklch, #f59e0b, transparent 92%)" }}
                    content={<FriendlyTooltip unit="learners flagged" />}
                  />
                  <Bar
                    dataKey="count"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={30}
                    animationDuration={750}
                    animationEasing="ease-out"
                  >
                    {gradeRows.map((r) => (
                      <Cell key={r.grade} style={{ fill: GRADE_BAR_FILL }} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
            <InsightCallout className="mt-auto">{gradeInterpretation}</InsightCallout>
          </>
        )}
      </KanbanBoard>
    </div>
  );
}
