"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell, Pie, PieChart } from "recharts";
import { PrincipalEmptyState } from "../../components/PrincipalEmptyCard";
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
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./OverviewRisk.module.css";

const chartConfig = {
  value: { label: "Students", color: "var(--primary)" },
} satisfies ChartConfig;

const FACTOR_COLORS: Record<FactorKey, string> = {
  attendance: "var(--primary)",
  grades: "color-mix(in oklch, var(--primary) 65%, var(--card))",
  behavior: "color-mix(in oklch, var(--primary) 35%, var(--card))",
};

const LEVEL_COLORS: Record<LevelKey, string> = {
  high: "var(--primary)",
  moderate: "color-mix(in oklch, var(--primary) 60%, var(--card))",
  low: "color-mix(in oklch, var(--primary) 30%, var(--card))",
};

const GRADE_BAR_FILL = "var(--primary)";

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
    const items: FactorRow[] = [
      { key: "attendance", label: "Attendance", value: atRisk.attendance, color: FACTOR_COLORS.attendance },
      { key: "grades", label: "Academics", value: atRisk.grades, color: FACTOR_COLORS.grades },
      { key: "behavior", label: "Behavior", value: atRisk.behavior, color: FACTOR_COLORS.behavior },
    ];
    return items;
  }, [data]);

  const interpretation = React.useMemo(
    () =>
      data?.atRisk
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

  const riskEmpty = !data || rows.length === 0 || rows.every((r) => r.value === 0) || (data.atRisk?.students ?? 0) === 0;

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

      <Card className={`${assign.card} ${styles.card}`}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        {!isPending && !isError && riskEmpty ? (
          <CardContent className={styles.content}>
            <PrincipalEmptyState
              icon={ShieldCheck}
              title="No at-risk students this term"
              hint="No students flagged at risk this term. New flags will appear here once detected."
            />
          </CardContent>
        ) : (
          <>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <CardTitle>Risk at a glance</CardTitle>
          </div>
          <CardAction>
            {isPending ? (
              <Skeleton className={styles.headerBadgeSkel} />
            ) : !riskEmpty ? (
              <Badge variant="secondary" className={styles.riskBadge}>
                {data?.atRisk.students ?? 0} at risk
              </Badge>
            ) : null}
          </CardAction>
        </CardHeader>
        <CardContent className={styles.content}>
          {isPending ? (
            <Skeleton className={styles.chartSkel} />
          ) : isError ? (
            <p className={styles.empty}>Could not load risk figures.</p>
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
                        <Cell key={r.key} style={{ fill: r.color }} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
              <p className={styles.chartInterpretation}>{interpretation}</p>
            </>
          )}
        </CardContent>
          </>
        )}
      </Card>

      <Card className={`${assign.card} ${styles.card}`}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        {!isPending && !isError && levelEmpty ? (
          <CardContent className={styles.content}>
            <PrincipalEmptyState
              icon={ShieldCheck}
              title="No level data"
              hint="No risk level breakdown available for the active term."
            />
          </CardContent>
        ) : (
          <>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <CardTitle>Students by risk level</CardTitle>
          </div>
          <CardAction>
            {isPending ? (
              <Skeleton className={styles.headerBadgeSkel} />
            ) : !levelEmpty ? (
              <Badge variant="secondary" className={styles.riskBadge}>
                {levelsTotal} tracked
              </Badge>
            ) : null}
          </CardAction>
        </CardHeader>
        <CardContent className={styles.content}>
          {isPending ? (
            <Skeleton className={styles.donutSkel} />
          ) : isError ? (
            <p className={styles.empty}>Could not load risk figures.</p>
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
                        <Cell key={entry.key} style={{ fill: entry.color }} />
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
          </>
        )}
      </Card>

      <Card className={`${assign.card} ${styles.card}`}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        {!isPending && !isError && gradeEmpty ? (
          <CardContent className={styles.content}>
            <PrincipalEmptyState
              icon={ShieldCheck}
              title="No at-risk students by grade"
              hint="No at-risk students by grade this term. Grade breakdowns will appear here once detected."
            />
          </CardContent>
        ) : (
          <>
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
                          <Cell key={r.grade} style={{ fill: GRADE_BAR_FILL }} />
                        ))}
                      </Bar>
                </BarChart>
              </ChartContainer>
              <p className={styles.chartInterpretation}>{gradeInterpretation}</p>
            </>
          )}
        </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
