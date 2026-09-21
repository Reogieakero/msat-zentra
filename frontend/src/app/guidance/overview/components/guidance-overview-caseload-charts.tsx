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
  GuidanceReferralTypeRow,
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

const TYPE_COLORS: Record<string, string> = {
  ADM: "var(--chart-1)",
  Counseling: "var(--chart-2)",
};

const BAR_END_RADIUS = 4;

type BarShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: { moderate?: number };
};

/* High segment of the stacked section bars: square on the left (axis /
   stack junction), rounded top-right + bottom-right only when it is the
   visible bar end — i.e. the row stacks no moderate segment after it.
   The moderate segment keeps radius={[0, 4, 4, 0]}, so the bar's right
   end is always rounded and the junction never is. */
function HighBarShape(props: BarShapeProps) {
  const { x = 0, y = 0, width = 0, height = 0, fill, payload } = props;
  if (width <= 0 || height <= 0) return null;
  const roundRight = (payload?.moderate ?? 0) === 0;
  const r = roundRight ? Math.min(BAR_END_RADIUS, width / 2, height / 2) : 0;
  if (r <= 0) {
    return <rect x={x} y={y} width={width} height={height} fill={fill} />;
  }
  return (
    <path
      d={
        `M ${x} ${y} ` +
        `H ${x + width - r} ` +
        `Q ${x + width} ${y} ${x + width} ${y + r} ` +
        `V ${y + height - r} ` +
        `Q ${x + width} ${y + height} ${x + width - r} ${y + height} ` +
        `H ${x} Z`
      }
      fill={fill}
    />
  );
}

interface GuidanceOverviewCaseloadChartsProps {
  referralsByType: GuidanceReferralTypeRow[];
  sectionHeat: GuidanceSectionHeatRow[];
}

function interpretReferralTypes(rows: GuidanceReferralTypeRow[]): string {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (total === 0) return "No cases referred to you for the active term yet.";
  const adm = rows.find((r) => r.type === "ADM")?.count ?? 0;
  const counseling = rows.find((r) => r.type === "Counseling")?.count ?? 0;
  return `${total} referred cases this term — ${adm} ADM and ${counseling} counseling.`;
}

export function GuidanceOverviewCaseloadCharts({
  referralsByType,
  sectionHeat,
}: GuidanceOverviewCaseloadChartsProps) {
  const referralsTotal = referralsByType.reduce((s, r) => s + r.count, 0);
  const topSections = [...sectionHeat]
    .sort((a, b) => b.high - a.high || b.moderate - a.moderate)
    .slice(0, 6);

  return (
    <div className={styles.chartGrid}>
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>Referred cases by type</CardTitle>
          <CardDescription className={styles.sectionDesc}>
            ADM vs counseling split of the cases on your desk this term.
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.cardBody}>
          {referralsTotal === 0 ? (
            <p className={styles.empty}>No cases referred to you this term.</p>
          ) : (
            <>
              <div className={styles.donutWrap}>
                <ResponsiveContainer width="100%" height={148}>
                  <PieChart>
                    <Pie
                      data={referralsByType}
                      dataKey="count"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {referralsByType.map((r) => (
                        <Cell key={r.type} fill={TYPE_COLORS[r.type] ?? "#737373"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className={styles.donutCenter}>
                  <span className={styles.donutValue}>{referralsTotal}</span>
                  <span className={styles.donutCaption}>records</span>
                </div>
              </div>
              <ul className={styles.legend}>
                {referralsByType.map((r) => (
                  <li key={r.type} className={styles.legendItem}>
                    <span className={styles.legendLabel}>
                      <span
                        className={styles.legendDot}
                        style={{ backgroundColor: TYPE_COLORS[r.type] ?? "#737373" }}
                        aria-hidden
                      />
                      {r.type}
                    </span>
                    <span className={styles.legendCount}>{r.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className={styles.interpretation}>{interpretReferralTypes(referralsByType)}</p>
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
                  <Bar dataKey="high" name="High" stackId="risk" fill="var(--chart-1)" maxBarSize={18} shape={<HighBarShape />} />
                  <Bar dataKey="moderate" name="Moderate" stackId="risk" fill="var(--chart-4)" radius={[0, 4, 4, 0]} maxBarSize={18} />
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
