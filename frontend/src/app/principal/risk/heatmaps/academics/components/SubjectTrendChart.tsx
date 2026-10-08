"use client";

import * as React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ALL_GRADES,
  gradeSortKey,
  round1,
  type BackendSectionRow,
} from "./types";
import styles from "./academics.module.css";

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
};

const GRADE_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#14b8a6",
  "#ef4444",
];

type TrendRow = {
  subject: string;
  [grade: string]: string | number | null;
};

type CellStat = { avg: number; graded: number; below: number };

const PASS_DOT = "#22c55e";
const FAIL_DOT = "#ef4444";
const EMPTY_BASELINE = 50;

function dotFor(grade: string, radius: number) {
  function TrendDot(props: {
    cx?: number;
    cy?: number;
    payload?: Record<string, unknown>;
  }) {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return <g />;
    const raw = payload ? payload[grade] : null;
    if (typeof raw !== "number") return <g />;
    const bad = raw < 75;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={bad ? radius + 1 : radius}
        style={{
          fill: bad ? FAIL_DOT : PASS_DOT,
          stroke: "var(--card)",
        }}
        strokeWidth={2}
      />
    );
  }
  return TrendDot;
}

function EmptyDot(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return <g />;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      style={{ fill: "#ffffff", stroke: "var(--muted-foreground)" }}
      strokeWidth={1.5}
      strokeDasharray="2 2"
    />
  );
}

function TrendTooltip({
  active,
  payload,
  label,
  detailByKey,
  series,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: string | number }[];
  label?: string | number;
  detailByKey: Record<string, CellStat>;
  series: string[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className={styles.chartTip}>
      <p className={styles.chartTipTitle}>{String(label ?? "")}</p>
      {series.map((grade) => {
        const entry = payload.find((p) => String(p.dataKey) === grade);
        if (!entry || entry.value == null || entry.value === "") {
          return (
            <p key={grade} className={styles.chartTipRow}>
              <span>{grade}</span>
              <span className={styles.chartTipMuted}>No grades yet</span>
            </p>
          );
        }
        const detail = detailByKey[`${label}::${grade}`];
        const avg = Number(entry.value);
        return (
          <p key={grade} className={styles.chartTipRow}>
            <span>{grade}</span>
            <span className={avg < 75 ? styles.chartTipBad : styles.chartTipAvg}>
              {avg}
              {detail
                ? ` · ${detail.graded} graded · ${detail.below} below 75`
                : ""}
            </span>
          </p>
        );
      })}
    </div>
  );
}

export function SubjectTrendChart({
  sections,
  subjects,
  grades,
  gradeFilter,
  isPending,
  selectedSubject,
  onSelectSubject,
}: {
  sections: BackendSectionRow[];
  subjects: string[];
  grades: string[];
  gradeFilter: string;
  isPending: boolean;
  selectedSubject: string | null;
  onSelectSubject: (subject: string | null) => void;
}) {
  const { chartData, detailByKey, series } = React.useMemo(() => {
    const inScope =
      gradeFilter === ALL_GRADES
        ? sections
        : sections.filter((s) => s.grade === gradeFilter);
    const activeGrades = (
      gradeFilter === ALL_GRADES
        ? grades
        : grades.filter((g) => g === gradeFilter)
    ).filter((g) => inScope.some((s) => s.grade === g));

    const acc = new Map<string, Map<string, { sum: number; count: number; below: number }>>();
    for (const s of inScope) {
      for (const st of s.students) {
        for (const subj of st.subjects) {
          let byGrade = acc.get(subj.subject);
          if (!byGrade) {
            byGrade = new Map();
            acc.set(subj.subject, byGrade);
          }
          const entry = byGrade.get(s.grade) ?? { sum: 0, count: 0, below: 0 };
          entry.sum += subj.transmutedGrade;
          entry.count += 1;
          if (subj.transmutedGrade < 75) entry.below += 1;
          byGrade.set(s.grade, entry);
        }
      }
    }

    const detail: Record<string, CellStat> = {};
    const rows: TrendRow[] = subjects.map((subj) => {
      const row: TrendRow = { subject: subj };
      const byGrade = acc.get(subj);
      for (const grade of activeGrades) {
        const entry = byGrade?.get(grade);
        if (entry && entry.count > 0) {
          const avg = round1(entry.sum / entry.count);
          row[grade] = avg;
          row[`__empty_${grade}`] = null;
          detail[`${subj}::${grade}`] = {
            avg,
            graded: entry.count,
            below: entry.below,
          };
        } else {
          row[grade] = null;
          row[`__empty_${grade}`] = EMPTY_BASELINE;
        }
      }
      return row;
    });
    return { chartData: rows, detailByKey: detail, series: activeGrades };
  }, [sections, subjects, grades, gradeFilter]);

  const belowCount = React.useMemo(
    () => Object.values(detailByKey).filter((d) => d.avg < 75).length,
    [detailByKey]
  );
  const lowest = React.useMemo(() => {
    let min: { key: string; stat: CellStat } | null = null;
    for (const [key, stat] of Object.entries(detailByKey)) {
      if (!min || stat.avg < min.stat.avg) min = { key, stat };
    }
    return min;
  }, [detailByKey]);

  const colorFor = React.useCallback(
    (grade: string) => {
      const idx = [...grades]
        .sort((a, b) => gradeSortKey(a) - gradeSortKey(b))
        .indexOf(grade);
      return GRADE_COLORS[Math.max(0, idx) % GRADE_COLORS.length];
    },
    [grades]
  );

  const hasData = chartData.some((row) =>
    series.some((g) => row[g] != null)
  );

  return (
    <Card className={styles.glowCard}>
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      <CardHeader>
        <div>
          <CardTitle>Subject trend</CardTitle>
          <CardDescription>
            {gradeFilter === ALL_GRADES
              ? "Average transmuted grade per subject, one line per grade level. Red is below 75, green is passing, white means no grades yet. Click a point to rank its sections."
              : `Average transmuted grade per subject for ${gradeFilter}. Red is below 75, green is passing, white means no grades yet. Click a point to rank its sections.`}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className={styles.chartBody}>
        {isPending ? (
          <Skeleton className={styles.chartSkel} aria-hidden />
        ) : !hasData ? (
          <p className={styles.empty}>No graded records for the active term.</p>
        ) : (
          <>
            <div className={styles.chartScroll}>
              <div className={styles.chartInner}>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 12, right: 16, bottom: 0, left: -8 }}
                    className={styles.chartClickable}
                    onClick={(state) => {
                      const label =
                        state && typeof state.activeLabel === "string"
                          ? state.activeLabel
                          : null;
                      if (!label) return;
                      onSelectSubject(
                        label === selectedSubject ? null : label
                      );
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="color-mix(in oklch, var(--foreground), transparent 90%)"
                    />
                    <XAxis
                      dataKey="subject"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      angle={-18}
                      textAnchor="end"
                      height={72}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      domain={[50, 100]}
                      ticks={[50, 60, 70, 75, 80, 90, 100]}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      width={36}
                    />
                    <Tooltip
                      content={
                        <TrendTooltip
                          detailByKey={detailByKey}
                          series={series}
                        />
                      }
                      contentStyle={TOOLTIP_STYLE}
                    />
                    {series.length > 1 ? (
                      <Legend
                        wrapperStyle={{ fontSize: 12 }}
                        formatter={(value) => (
                          <span className={styles.chartLegend}>{value}</span>
                        )}
                      />
                    ) : null}
                    <ReferenceLine
                      y={75}
                      stroke="var(--destructive)"
                      strokeDasharray="6 4"
                      label={{
                        value: "Passing (75)",
                        position: "insideTopRight",
                        fontSize: 11,
                        fill: "var(--destructive)",
                      }}
                    />
                    {series.map((grade) => {
                      const color = colorFor(grade);
                      return (
                        <Line
                          key={grade}
                          type="monotone"
                          dataKey={grade}
                          name={grade}
                          stroke={color}
                          strokeWidth={2.5}
                          dot={dotFor(grade, 4)}
                          activeDot={dotFor(grade, 6)}
                        />
                      );
                    })}

                    {series.map((grade) => (
                      <Line
                        key={`empty-${grade}`}
                        type="monotone"
                        dataKey={`__empty_${grade}`}
                        stroke="transparent"
                        dot={<EmptyDot />}
                        activeDot={false}
                        legendType="none"
                        tooltipType="none"
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={styles.dotLegend} aria-label="Dot meaning">
              <span className={styles.dotLegendItem}>
                <span
                  className={styles.dotLegendDot}
                  style={{ backgroundColor: "var(--destructive)" }}
                  aria-hidden
                />
                Below 75
              </span>
              <span className={styles.dotLegendItem}>
                <span
                  className={styles.dotLegendDot}
                  style={{ backgroundColor: "#22c55e" }}
                  aria-hidden
                />
                75 and above
              </span>
              <span className={styles.dotLegendItem}>
                <span
                  className={styles.dotLegendDot}
                  style={{ backgroundColor: "#ffffff" }}
                  aria-hidden
                />
                No grades yet
              </span>
              {selectedSubject ? (
                <span className={styles.dotLegendSelected}>
                  Selected: {selectedSubject} (click again to clear)
                </span>
              ) : (
                <span className={styles.dotLegendHint}>
                  Click any point to rank its sections
                </span>
              )}
            </div>
            <p className={styles.interpretation}>
              <span className={styles.interpretationLabel}>What it means · </span>
              {belowCount === 0
                ? "Every subject trend sits at or above 75 — clear."
                : lowest
                  ? `${belowCount} grade–subject point${belowCount === 1 ? "" : "s"} below 75. Lowest: ${lowest.key.replace("::", " · ")} at ${lowest.stat.avg}.`
                  : `${belowCount} grade–subject points below 75.`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
