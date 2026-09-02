"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell, Pie, PieChart } from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { fetchOverview } from "./overview-data";
import styles from "./OverviewRisk.module.css";

const chartConfig = {
  value: { label: "Students", color: "#2563eb" },
} satisfies ChartConfig;

type FactorKey = "attendance" | "grades" | "behavior";

const FACTOR_COLORS: Record<FactorKey, string> = {
  attendance: "#f59e0b",
  grades: "#3b82f6",
  behavior: "#ef4444",
};

interface FactorRow {
  key: FactorKey;
  label: string;
  value: number;
  color: string;
}

type LevelKey = "high" | "moderate" | "low";

const LEVEL_COLORS: Record<LevelKey, string> = {
  high: "#ef4444",
  moderate: "#f59e0b",
  low: "#16a34a",
};

interface LevelRow {
  key: LevelKey;
  label: string;
  value: number;
  color: string;
}

function interpretRisk(
  attendance: number,
  grades: number,
  behavior: number,
  students: number,
  enrollment: number
): string {
  if (students === 0) {
    return "No students are currently flagged at risk for the active term.";
  }

  const rows: FactorRow[] = [
    { key: "attendance", label: "Attendance", value: attendance, color: FACTOR_COLORS.attendance },
    { key: "grades", label: "Academics", value: grades, color: FACTOR_COLORS.grades },
    { key: "behavior", label: "Behavior", value: behavior, color: FACTOR_COLORS.behavior },
  ];
  rows.sort((a, b) => b.value - a.value);

  const pct = Math.round((students / Math.max(enrollment, 1)) * 100);
  const top = rows[0];
  const second = rows[1];
  const third = rows[2];

  const insights: string[] = [
    `${students} of ${enrollment} students (${pct}%) are flagged at risk this term.`,
  ];
  if (top.value > 0) {
    insights.push(
      `${top.label} is the most common trigger, affecting ${top.value} student(s).`
    );
  }
  if (second.value > 0) {
    insights.push(`${second.label} follows at ${second.value}, and ${third.label} at ${third.value}.`);
  }

  return insights.join(" ");
}

function interpretLevels(high: number, moderate: number, low: number): string {
  const total = high + moderate + low;
  if (total === 0) {
    return "No students are tracked by risk level this term.";
  }
  const hp = Math.round((high / total) * 100);
  const mp = Math.round((moderate / total) * 100);
  const lp = 100 - hp - mp;
  const phrases: string[] = [`${total} students split by live risk level.`];
  if (high === total) {
    phrases[0] = `Every student tracked (${total}) is flagged High risk this term.`;
  } else {
    const parts: string[] = [];
    if (high > 0) parts.push(`${high} (${hp}%) High`);
    if (moderate > 0) parts.push(`${moderate} (${mp}%) Moderate`);
    parts.push(`${low} (${lp}%) Low`);
    phrases.push(parts.join(", ") + " — High means two or more factors, Moderate means one.");
  }
  return phrases.join(" ");
}

function interpretGradeRisk(rows: { grade: string; count: number }[]): string {
  const atRisk = rows.reduce((sum, r) => sum + r.count, 0);
  if (atRisk === 0) {
    return "No at-risk students across grade levels this term.";
  }
  const ranked = [...rows].sort((a, b) => b.count - a.count);
  const top = ranked[0];
  const pct = Math.round((top.count / atRisk) * 100);
  const present = rows.filter((r) => r.count > 0).length;
  const phrases: string[] = [
    `${atRisk} at-risk students spread across ${present} grade level(s).`,
  ];
  phrases.push(
    `${top.grade} carries the heaviest load with ${top.count} (${pct}%) of all at-risk learners.`
  );
  if (ranked[1] && ranked[1].count > 0) {
    phrases.push(`${ranked[1].grade} follows with ${ranked[1].count}.`);
  }
  return phrases.join(" ");
}

function useOverview() {
  return useQuery({
    queryKey: ["overview"],
    queryFn: fetchOverview,
  });
}

export function OverviewRisk() {
  const { data, isPending, isError } = useOverview();

  const rows: FactorRow[] = React.useMemo(() => {
    const atRisk = data?.atRisk;
    if (!atRisk) return [];
    const items: FactorRow[] = [
      { key: "attendance", label: "Attendance", value: atRisk.attendance, color: FACTOR_COLORS.attendance },
      { key: "grades", label: "Academics", value: atRisk.grades, color: FACTOR_COLORS.grades },
      { key: "behavior", label: "Behavior", value: atRisk.behavior, color: FACTOR_COLORS.behavior },
    ];
    return items;
  }, [data]);

  const interpretation = React.useMemo(
    () =>
      data
        ? interpretRisk(
            data.atRisk.attendance,
            data.atRisk.grades,
            data.atRisk.behavior,
            data.atRisk.students,
            data.kpis.enrollment
          )
        : "",
    [data]
  );

  const noFlags = rows.length > 0 && rows.every((r) => r.value === 0);

  const levelRows: LevelRow[] = React.useMemo(() => {
    const levels = data?.riskByLevel;
    if (!levels) return [];
    const items: LevelRow[] = [
      { key: "high", label: "High", value: levels.high, color: LEVEL_COLORS.high },
      { key: "moderate", label: "Moderate", value: levels.moderate, color: LEVEL_COLORS.moderate },
      { key: "low", label: "Low", value: levels.low, color: LEVEL_COLORS.low },
    ];
    return items;
  }, [data]);

  const levelsTotal = levelRows.reduce((sum, r) => sum + r.value, 0);

  const levelInterpretation = React.useMemo(
    () =>
      data
        ? interpretLevels(data.riskByLevel.high, data.riskByLevel.moderate, data.riskByLevel.low)
        : "",
    [data]
  );

  const gradeRows = React.useMemo(() => data?.riskByGrade ?? [], [data]);
  const noGradeRisk = gradeRows.length > 0 && gradeRows.every((r) => r.count === 0);

  const gradeInterpretation = React.useMemo(
    () => (data ? interpretGradeRisk(data.riskByGrade) : ""),
    [data]
  );

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Risk at a glance</CardTitle>
          <CardDescription>
            Students flagging on each risk factor, recomputed from the shared risk engine.
          </CardDescription>
        </div>
        <CardAction>
          {isPending ? (
            <Skeleton className={styles.headerBadgeSkel} />
          ) : (
            <Badge variant="secondary" className={styles.riskBadge}>
              {data?.atRisk.students ?? 0} at risk
            </Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className={styles.content}>
        {isPending ? (
          <Skeleton className={styles.chartSkel} />
        ) : isError ? (
          <p className={styles.empty}>Could not load risk figures.</p>
        ) : noFlags ? (
          <p className={styles.empty}>No students flagged at risk this term.</p>
        ) : (
          <>
            <div className={styles.chartWrap}>
              <ChartContainer config={chartConfig} className={styles.chart}>
                <BarChart
                  data={rows}
                  margin={{ top: 8, right: 8, bottom: 0, left: -6 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={12}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent formatter={(value) => `${value} student(s)`} />
                    }
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {rows.map((r) => (
                      <Cell key={r.key} fill={r.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
            <p className={styles.chartInterpretation}>{interpretation}</p>

            <div className={styles.chartsRow}>
              {/* Donut — students by risk level */}
              <div className={styles.chartBox}>
                <h4 className={styles.chartHeading}>Students by risk level</h4>
                {isPending ? (
                  <Skeleton className={styles.donutSkel} />
                ) : levelRows.length === 0 ? (
                  <p className={styles.chartEmpty}>No level data.</p>
                ) : (
                  <div className={styles.donutWrap}>
                    <ChartContainer config={chartConfig} className={styles.donut}>
                      <PieChart>
                        <Pie
                          data={levelRows}
                          dataKey="value"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          innerRadius={44}
                          outerRadius={70}
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          {levelRows.map((entry) => (
                            <Cell key={entry.key} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className={styles.donutCenter}>
                      <span className={styles.donutTotal}>{levelsTotal}</span>
                      <span className={styles.donutLabel}>students</span>
                    </div>
                  </div>
                )}
                <ul className={styles.levelList}>
                  {levelRows.map((r) => (
                    <li key={r.key} className={styles.levelItem}>
                      <span className={styles.levelLabel}>
                        <span
                          className={styles.levelDot}
                          style={{ backgroundColor: r.color }}
                          aria-hidden
                        />
                        {r.label}
                      </span>
                      <span className={styles.levelCount}>{r.value}</span>
                    </li>
                  ))}
                </ul>
                <p className={styles.chartInterpretation}>{levelInterpretation}</p>
              </div>

              {/* Bar — at-risk students by grade level */}
              <div className={styles.chartBox}>
                <h4 className={styles.chartHeading}>At-risk students by grade</h4>
                {isPending ? (
                  <Skeleton className={styles.barSkel} />
                ) : noGradeRisk ? (
                  <p className={styles.chartEmpty}>No at-risk students by grade this term.</p>
                ) : (
                  <ChartContainer config={chartConfig} className={styles.gradeChart}>
                    <BarChart
                      data={gradeRows}
                      margin={{ top: 8, right: 8, bottom: 0, left: -6 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="grade"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={10}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        width={32}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent formatter={(value) => `${value} student(s)`} />
                        }
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {gradeRows.map((r) => (
                          <Cell key={r.grade} fill="#2563eb" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
                <p className={styles.chartInterpretation}>{gradeInterpretation}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}