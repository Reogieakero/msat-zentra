"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell, Pie, PieChart } from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
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
import { useTheme } from "@/components/providers";
import styles from "./OverviewRisk.module.css";

const chartConfigLight = {
  value: { label: "Students", color: "#171717" },
} satisfies ChartConfig;

const chartConfigDark = {
  value: { label: "Students", color: "#e5e5e5" },
} satisfies ChartConfig;

type FactorKey = "attendance" | "grades" | "behavior";

// Light mode: ink-to-gray ramp for light surfaces.
// Dark mode: mirrored paper-to-gray ramp so bars stay legible on dark cards.
const FACTOR_COLORS_LIGHT: Record<FactorKey, string> = {
  attendance: "#171717",
  grades: "#525252",
  behavior: "#a3a3a3",
};

const FACTOR_COLORS_DARK: Record<FactorKey, string> = {
  attendance: "#fafafa",
  grades: "#a3a3a3",
  behavior: "#525252",
};

interface FactorRow {
  key: FactorKey;
  label: string;
  value: number;
  color: string;
}

type LevelKey = "high" | "moderate" | "low";

const LEVEL_COLORS_LIGHT: Record<LevelKey, string> = {
  high: "#171717",
  moderate: "#6b7280",
  low: "#d1d5db",
};

const LEVEL_COLORS_DARK: Record<LevelKey, string> = {
  high: "#fafafa",
  moderate: "#9ca3af",
  low: "#4b5563",
};

const GRADE_BAR_LIGHT = "#171717";
const GRADE_BAR_DARK = "#e5e5e5";

function useIsDark() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted && resolvedTheme === "dark";
}

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
    { key: "attendance", label: "Attendance", value: attendance, color: "" },
    { key: "grades", label: "Academics", value: grades, color: "" },
    { key: "behavior", label: "Behavior", value: behavior, color: "" },
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
  const isDark = useIsDark();
  const chartConfig = isDark ? chartConfigDark : chartConfigLight;
  const gradeBarFill = isDark ? GRADE_BAR_DARK : GRADE_BAR_LIGHT;

  const rows: FactorRow[] = React.useMemo(() => {
    const atRisk = data?.atRisk;
    if (!atRisk) return [];
    const colors = isDark ? FACTOR_COLORS_DARK : FACTOR_COLORS_LIGHT;
    const items: FactorRow[] = [
      { key: "attendance", label: "Attendance", value: atRisk.attendance, color: colors.attendance },
      { key: "grades", label: "Academics", value: atRisk.grades, color: colors.grades },
      { key: "behavior", label: "Behavior", value: atRisk.behavior, color: colors.behavior },
    ];
    return items;
  }, [data, isDark]);

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
    const colors = isDark ? LEVEL_COLORS_DARK : LEVEL_COLORS_LIGHT;
    const items: LevelRow[] = [
      { key: "high", label: "High", value: levels.high, color: colors.high },
      { key: "moderate", label: "Moderate", value: levels.moderate, color: colors.moderate },
      { key: "low", label: "Low", value: levels.low, color: colors.low },
    ];
    return items;
  }, [data, isDark]);

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
    <div className={styles.riskGrid}>
      {/* Card 1 — Risk at a glance */}
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <CardTitle>Risk at a glance</CardTitle>
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Card 2 — Students by risk level */}
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <CardTitle>Students by risk level</CardTitle>
          </div>
          <CardAction>
            {isPending ? (
              <Skeleton className={styles.headerBadgeSkel} />
            ) : (
              <Badge variant="secondary" className={styles.riskBadge}>
                {levelsTotal} tracked
              </Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardContent className={styles.content}>
          {isPending ? (
            <Skeleton className={styles.donutSkel} />
          ) : isError ? (
            <p className={styles.empty}>Could not load risk figures.</p>
          ) : levelRows.length === 0 ? (
            <p className={styles.chartEmpty}>No level data.</p>
          ) : (
            <>
              <div className={styles.donutWrap}>
                <ChartContainer config={chartConfig} className={styles.donut}>
                  <PieChart>
                    <ChartTooltip
                      wrapperStyle={{ zIndex: 50 }}
                      content={
                        <ChartTooltipContent
                          className={styles.tooltipSolid}
                          formatter={(value, name) => `${name}: ${value} student(s)`}
                        />
                      }
                    />
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Card 3 — At-risk students by grade */}
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <CardTitle>At-risk students by grade</CardTitle>
          </div>
        </CardHeader>
        <CardContent className={styles.content}>
          {isPending ? (
            <Skeleton className={styles.barSkel} />
          ) : isError ? (
            <p className={styles.empty}>Could not load risk figures.</p>
          ) : noGradeRisk ? (
            <p className={styles.chartEmpty}>No at-risk students by grade this term.</p>
          ) : (
            <>
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
                          <Cell key={r.grade} fill={gradeBarFill} />
                        ))}
                      </Bar>
                </BarChart>
              </ChartContainer>
              <p className={styles.chartInterpretation}>{gradeInterpretation}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
