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
  GuidanceSectionHeatRow,
} from "./guidance-overview-data";
import styles from "./guidance-overview-caseload-charts.module.css";

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
};

const CATEGORY_COLORS: Record<string, string> = {
  behavioral: "#171717",
  bullying: "#525252",
  academic: "#737373",
  attendance: "#a3a3a3",
  health: "#d4d4d4",
};

interface GuidanceOverviewCaseloadChartsProps {
  anecdotalByCategory: GuidanceCategoryRow[];
  sectionHeat: GuidanceSectionHeatRow[];
}

function interpretAnecdotal(rows: GuidanceCategoryRow[]): string {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (total === 0) return "No cases referred to you for the active term yet.";
  const top = [...rows].sort((a, b) => b.count - a.count)[0];
  return `${total} referred cases this term — most filed as ${top.category} (${top.count}). Unreferred filings are not counted here.`;
}

export function GuidanceOverviewCaseloadCharts({
  anecdotalByCategory,
  sectionHeat,
}: GuidanceOverviewCaseloadChartsProps) {
  const anecdotalTotal = anecdotalByCategory.reduce((s, r) => s + r.count, 0);
  const topSections = [...sectionHeat]
    .sort((a, b) => b.high - a.high || b.moderate - a.moderate)
    .slice(0, 6);

  return (
    <div className={styles.chartGrid}>
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>Referred cases by category</CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Only cases advisers referred to you this term — you cannot browse
            unreferred filings.
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.cardBody}>
          {anecdotalTotal === 0 ? (
            <p className={styles.empty}>No cases referred to you this term.</p>
          ) : (
            <>
              <div className={styles.donutWrap}>
                <ResponsiveContainer width="100%" height={148}>
                  <PieChart>
                    <Pie
                      data={anecdotalByCategory}
                      dataKey="count"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {anecdotalByCategory.map((r) => (
                        <Cell key={r.category} fill={CATEGORY_COLORS[r.category] ?? "#737373"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className={styles.donutCenter}>
                  <span className={styles.donutValue}>{anecdotalTotal}</span>
                  <span className={styles.donutCaption}>records</span>
                </div>
              </div>
              <ul className={styles.legend}>
                {anecdotalByCategory.map((r) => (
                  <li key={r.category} className={styles.legendItem}>
                    <span className={styles.legendLabel}>
                      <span
                        className={styles.legendDot}
                        style={{ backgroundColor: CATEGORY_COLORS[r.category] ?? "#737373" }}
                        aria-hidden
                      />
                      {r.category}
                    </span>
                    <span className={styles.legendCount}>{r.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className={styles.interpretation}>{interpretAnecdotal(anecdotalByCategory)}</p>
        </CardContent>
      </Card>

      <Card className={styles.cardWide}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>Sections needing attention</CardTitle>
          <CardDescription className={styles.sectionDesc}>
            High-risk students per section · top 6 sections.
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.cardBody}>
          {topSections.every((s) => s.high === 0 && s.moderate === 0) ? (
            <p className={styles.empty}>No section has at-risk students right now.</p>
          ) : (
            <div className={styles.barWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSections} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
                  <XAxis type="number" hide domain={[0, (dataMax: number) => Math.max(1, dataMax)]} />
                  <YAxis
                    type="category"
                    dataKey="section"
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tick={{ fontSize: 12, fill: "var(--foreground)" }}
                  />
                  <Tooltip cursor={{ fill: "color-mix(in oklch, var(--foreground), transparent 95%)" }} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="high" name="High" stackId="risk" fill="#171717" maxBarSize={18} />
                  <Bar dataKey="moderate" name="Moderate" stackId="risk" fill="#a3a3a3" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className={styles.interpretation}>
            {topSections.length === 0
              ? "No sections found for the active school year."
              : `${topSections[0]?.section} leads with ${topSections[0]?.high} high-risk and ${topSections[0]?.moderate} moderate-risk students.`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
