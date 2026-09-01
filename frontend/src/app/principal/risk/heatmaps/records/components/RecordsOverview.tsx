"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell, Pie, PieChart } from "recharts";
import {
  CalendarDays,
  Clock,
  FileText,
  TriangleAlert,
  Users,
} from "lucide-react";
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
import type { RecordStudent } from "../types";
import {
  CATEGORY_META,
  CATEGORY_KEYS,
  categoryColor,
  fetchRecords,
  titleCase,
} from "./records-data";
import styles from "./RecordsOverview.module.css";

const chartConfig = {
  value: { label: "Records", color: "#2563eb" },
} satisfies ChartConfig;

type Severity = "Low" | "Moderate" | "High";

interface Kpi {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  value: string;
  suffix?: string;
  tone: "default" | "good" | "warn";
}

function severityTone(sev: Severity): string {
  return sev === "High"
    ? styles.sevHigh
    : sev === "Moderate"
      ? styles.sevModerate
      : styles.sevLow;
}

function interpretCategoryBreakdown(
  rows: { label: string; value: number }[],
  total: number,
  severityTotals: { sev: string; count: number }[]
): string {
  if (total === 0) return "No records on file for the active term.";

  const insights: string[] = [];

  // Category distribution insight
  if (rows.length === 1) {
    insights.push(`All ${total} record${total !== 1 ? "s" : ""} fall under ${rows[0].label.toLowerCase()}.`);
  } else {
    const top = rows[0];
    const pct = Math.round((top.value / total) * 100);
    insights.push(`${top.label} dominates at ${pct}% (${top.value} of ${total} records).`);

    if (rows.length > 1) {
      const second = rows[1];
      const secondPct = Math.round((second.value / total) * 100);
      insights.push(`${second.label} is second at ${secondPct}%.`);
    }

    if (rows.length > 2) {
      const remaining = rows.slice(2).reduce((s, r) => s + r.value, 0);
      const remainingPct = Math.round((remaining / total) * 100);
      insights.push(`${rows.length - 2} other categor${rows.length - 2 !== 1 ? "ies" : "y"} account for the remaining ${remainingPct}%.`);
    }
  }

  // Severity insight
  const highSev = severityTotals.find((s) => s.sev === "High");
  const modSev = severityTotals.find((s) => s.sev === "Moderate");
  const highCount = highSev?.count ?? 0;
  const modCount = modSev?.count ?? 0;

  if (highCount > 0) {
    const highPct = Math.round((highCount / total) * 100);
    insights.push(`${highCount} high-severity incident${highCount !== 1 ? "s" : ""} (${highPct}%) require immediate attention.`);
  } else if (modCount > 0) {
    insights.push(`${modCount} moderate incident${modCount !== 1 ? "s" : ""} on record, no high-severity cases.`);
  } else {
    insights.push("All incidents are low-severity.");
  }

  // Concentration insight
  if (rows.length >= 2) {
    const topTwo = rows[0].value + rows[1].value;
    const topTwoPct = Math.round((topTwo / total) * 100);
    if (topTwoPct >= 75) {
      insights.push(`${topTwoPct}% of records concentrate in two categories — targeted intervention recommended.`);
    }
  }

  return insights.join(" ");
}

export function RecordsOverview() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["records-heatmap"],
    queryFn: fetchRecords,
  });

  const allStudents = React.useMemo(
    () => data?.sections.flatMap((s) => s.students) ?? [],
    [data]
  );

  const allRecords = React.useMemo(
    () => allStudents.flatMap((s) => s.behavioral),
    [allStudents]
  );

  const categoryRows = React.useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; color: string; value: number }
    >();
    for (const key of CATEGORY_KEYS) {
      map.set(key, {
        key,
        label: CATEGORY_META[key].label,
        color: CATEGORY_META[key].color,
        value: 0,
      });
    }
    for (const rec of allRecords) {
      const row = map.get(rec.category);
      if (row) row.value += 1;
    }
    return Array.from(map.values())
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [allRecords]);

  const chartData = React.useMemo(() => {
    const row: Record<string, string | number> = { _id: "distribution" };
    for (const r of categoryRows) {
      row[r.label] = r.value;
    }
    return [row];
  }, [categoryRows]);

  const categoryTotal = categoryRows.reduce((s, r) => s + r.value, 0);

  const severityTotals = React.useMemo(() => {
    return (["High", "Moderate", "Low"] as Severity[]).map((sev) => ({
      sev,
      count: allRecords.filter((r) => r.severity === sev).length,
    }));
  }, [allRecords]);

  const categoryInterpretation = interpretCategoryBreakdown(categoryRows, categoryTotal, severityTotals);

  const highCount = allRecords.filter((r) => r.severity === "High").length;
  const unresolvedCount = allRecords.filter((r) => r.followUp !== "Resolved").length;

  const attention = React.useMemo(() => {
    const highWeight = (s: RecordStudent) =>
      s.behavioral.filter((r) => r.severity === "High").length;
    return [...allStudents]
      .sort((a, b) => {
        const d = b.behavioral.length - a.behavioral.length;
        return d !== 0 ? d : highWeight(b) - highWeight(a);
      })
      .slice(0, 6);
  }, [allStudents]);

  const kpis: Kpi[] = [
    {
      icon: FileText,
      label: "Total records",
      value: allRecords.length.toLocaleString(),
      tone: "default",
    },
    {
      icon: Users,
      label: "Students tracked",
      value: allStudents.length.toLocaleString(),
      tone: "default",
    },
    {
      icon: TriangleAlert,
      label: "High severity",
      value: String(highCount),
      tone: highCount > 0 ? "warn" : "good",
    },
    {
      icon: Clock,
      label: "Unresolved",
      value: String(unresolvedCount),
      tone: unresolvedCount > 0 ? "warn" : "good",
    },
  ];

  return (
    <div className={styles.stack}>
      {/* Card 1 — breakdown */}
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <CardTitle>Behavioral record breakdown</CardTitle>
            <CardDescription>
              Records grouped by anecdotal category and severity for the active term.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className={styles.content}>
          {isPending ? (
            <div className={styles.rowSkel}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className={styles.rowSkelItem} />
              ))}
            </div>
          ) : isError ? (
            <p className={styles.empty}>Could not load student records.</p>
          ) : categoryRows.length === 0 ? (
            <p className={styles.empty}>No records this term.</p>
          ) : (
            <>
              <div className={styles.statRow}>
                {kpis.map((k) => (
                  <div key={k.label} className={styles.statItem}>
                    <span className={`${styles.statIcon} ${styles[`tone_${k.tone}`]}`}>
                      <k.icon size={14} aria-hidden />
                    </span>
                    <span className={styles.statValue}>{k.value}</span>
                    <span className={styles.statLabel}>{k.label}</span>
                  </div>
                ))}
              </div>

              <div className={styles.donutWrap}>
                <ChartContainer config={chartConfig} className={styles.donut}>
                  <PieChart>
                    <Pie
                      data={categoryRows}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={64}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {categoryRows.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className={styles.donutCenter}>
                  <span className={styles.donutTotal}>{categoryTotal}</span>
                  <span className={styles.donutLabel}>records</span>
                </div>
              </div>

              <ul className={styles.catGrid}>
                {categoryRows.map((row) => {
                  const sevBreakdown = severityTotals.map((s) => {
                    const count = allRecords.filter(
                      (r) => r.category === row.key && r.severity === s.sev
                    ).length;
                    return { sev: s.sev, count };
                  });
                  return (
                    <li key={row.key} className={styles.catGridItem}>
                      <div className={styles.catGridTop}>
                        <span className={styles.catGridLabel}>
                          <span
                            className={styles.catGridDot}
                            style={{ backgroundColor: row.color }}
                            aria-hidden
                          />
                          {row.label}
                        </span>
                        <span className={styles.catGridCount}>{row.value}</span>
                      </div>
                      <div className={styles.catGridSevs}>
                        {sevBreakdown
                          .filter((s) => s.count > 0)
                          .map((s) => (
                            <span
                              key={s.sev}
                              className={`${styles.catGridSev} ${severityTone(s.sev)}`}
                            >
                              {s.count}
                            </span>
                          ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      {/* Card 2 — category chart */}
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <CardTitle>Records by category</CardTitle>
            <CardDescription>
              Anecdotal records grouped by category for the active term.
            </CardDescription>
          </div>
          <CardAction>
            <Badge variant="secondary">{data?.schoolYear ?? "—"}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className={styles.content}>
          {isPending ? (
            <Skeleton className={styles.chartSkel} />
          ) : isError ? (
            <p className={styles.empty}>Could not load student records.</p>
          ) : categoryRows.length === 0 ? (
            <p className={styles.empty}>No records this term.</p>
          ) : (
            <div className={styles.chartSplit}>
              <ChartContainer config={chartConfig} className={styles.chart}>
                <BarChart
                  data={categoryRows}
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
                      <ChartTooltipContent
                        formatter={(value) => `${value} record(s)`}
                      />
                    }
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {categoryRows.map((c) => (
                      <Cell key={c.key} fill={c.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
              <p className={styles.chartInterpretation}>{categoryInterpretation}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card 3 — needs attention */}
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <CardTitle className={styles.attentionTitle}>
              <TriangleAlert className={styles.attentionIcon} aria-hidden />
              Needs attention
            </CardTitle>
            <CardDescription>
              Students carrying the heaviest record load this term.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className={styles.content}>
          {isPending ? (
            <div className={styles.alertSkel}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className={styles.alertSkelRow} />
              ))}
            </div>
          ) : attention.length === 0 ? (
            <p className={styles.alertEmpty}>
              No students with records this term.
            </p>
          ) : (
            <ul className={styles.alertList}>
              {attention.map((s) => (
                <li key={s.lrn} className={styles.alertItem}>
                  <span className={styles.alertMain}>
                    <span className={styles.alertName}>{s.name}</span>
                    <span className={styles.alertSub}>
                      {s.section} · {s.lrn}
                    </span>
                  </span>
                  <span className={styles.alertMeta}>
                    <span
                      className={styles.alertDot}
                      style={{ backgroundColor: categoryColor(s) }}
                      aria-hidden
                    />
                    <Badge
                      variant="secondary"
                      className={styles.alertRate}
                    >
                      {s.behavioral.length}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className={styles.schoolYear}>
            <CalendarDays className={styles.schoolYearIcon} aria-hidden />
            {data?.schoolYear ?? "Active school year"} · active term
          </p>
        </CardContent>
      </Card>
    </div>
  );
}