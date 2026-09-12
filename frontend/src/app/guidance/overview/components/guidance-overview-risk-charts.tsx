"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  GuidanceCategoryRow,
  GuidanceRiskByGradeRow,
} from "./guidance-overview-data";
import styles from "./guidance-overview-risk-charts.module.css";

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
};

const LEVEL_COLORS: Record<string, string> = {
  High: "var(--chart-1)",
  Moderate: "var(--chart-3)",
  Low: "var(--chart-5)",
};

const FACTOR_COLOR = "var(--chart-1)";

interface GuidanceOverviewRiskChartsProps {
  riskByLevel: { high: number; moderate: number; low: number };
  factorTotals: { attendance: number; grades: number; behavior: number };
  riskByGrade: GuidanceRiskByGradeRow[];
}

function interpretLevels(high: number, moderate: number, low: number): string {
  const total = high + moderate + low;
  if (total === 0) return "No enrolled students found for the active school year.";
  return `${high} high and ${moderate} moderate out of ${total} students recomputed live for the active term.`;
}

function interpretFactors(attendance: number, grades: number, behavior: number): string {
  const total = attendance + grades + behavior;
  if (total === 0) return "No risk flags tripped this term — every student clears all three checks.";
  return `${grades} academic, ${attendance} attendance, and ${behavior} behavioral flags active. One student can trip several flags.`;
}

export function GuidanceOverviewRiskCharts({
  riskByLevel,
  factorTotals,
  riskByGrade,
}: GuidanceOverviewRiskChartsProps) {
  const levelSlices = [
    { label: "High", value: riskByLevel.high },
    { label: "Moderate", value: riskByLevel.moderate },
    { label: "Low", value: riskByLevel.low },
  ];
  const levelTotal = levelSlices.reduce((s, r) => s + r.value, 0);

  const factorRows = [
    { factor: "Academic", count: factorTotals.grades },
    { factor: "Attendance", count: factorTotals.attendance },
    { factor: "Behavioral", count: factorTotals.behavior },
  ];

  const gradeRows = riskByGrade.map((r) => ({ grade: r.short, count: r.count }));
  const maxGrade = Math.max(1, ...gradeRows.map((r) => r.count));

  return (
    <div className={styles.chartGrid}>
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>Risk levels</CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Live recompute · High ≥ 2 flags, Moderate = 1, Low = 0.
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.cardBody}>
          {levelTotal === 0 ? (
            <p className={styles.empty}>No students enrolled.</p>
          ) : (
            <>
              <div className={styles.donutWrap}>
                <ResponsiveContainer width="100%" height={148}>
                  <PieChart>
                    <Pie
                      data={levelSlices}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {levelSlices.map((s) => (
                        <Cell key={s.label} fill={LEVEL_COLORS[s.label]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className={styles.donutCenter}>
                  <span className={styles.donutValue}>{levelTotal}</span>
                  <span className={styles.donutCaption}>students</span>
                </div>
              </div>
              <ul className={styles.legend}>
                {levelSlices.map((s) => (
                  <li key={s.label} className={styles.legendItem}>
                    <span className={styles.legendLabel}>
                      <span
                        className={styles.legendDot}
                        style={{ backgroundColor: LEVEL_COLORS[s.label] }}
                        aria-hidden
                      />
                      {s.label}
                    </span>
                    <span className={styles.legendCount}>{s.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className={styles.interpretation}>
            {interpretLevels(riskByLevel.high, riskByLevel.moderate, riskByLevel.low)}
          </p>
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>Risk factors</CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Students tripping each flag this term.
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.cardBody}>
          <div className={styles.barWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={factorRows} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
                <XAxis type="number" hide domain={[0, (dataMax: number) => Math.max(1, dataMax)]} />
                <YAxis
                  type="category"
                  dataKey="factor"
                  tickLine={false}
                  axisLine={false}
                  width={82}
                  tick={{ fontSize: 12, fill: "var(--foreground)" }}
                />
                <Tooltip cursor={{ fill: "color-mix(in oklch, var(--foreground), transparent 95%)" }} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Students" radius={[0, 4, 4, 0]} fill={FACTOR_COLOR} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className={styles.interpretation}>
            {interpretFactors(factorTotals.attendance, factorTotals.grades, factorTotals.behavior)}
          </p>
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>At-risk by grade</CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Moderate + High students per grade level.
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.cardBody}>
          <div className={styles.barWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeRows} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
                <XAxis
                  dataKey="grade"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  domain={[0, maxGrade]}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  width={28}
                />
                <Tooltip cursor={{ fill: "color-mix(in oklch, var(--foreground), transparent 95%)" }} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="At-risk" radius={[4, 4, 0, 0]} fill={FACTOR_COLOR} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className={styles.interpretation}>
            {gradeRows.every((r) => r.count === 0)
              ? "No grade level has at-risk students right now."
              : `Highest: ${[...gradeRows].sort((a, b) => b.count - a.count)[0]?.grade} with ${[...gradeRows].sort((a, b) => b.count - a.count)[0]?.count} students needing attention.`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export type { GuidanceCategoryRow };
