"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";
import styles from "./OverviewGradeChart.module.css";

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
  boxShadow: "0 4px 12px -6px rgb(0 0 0 / 0.25)",
};

const TOTAL_COLOR = "var(--primary)";

interface BreakdownGroup {
  id: string;
  label: string;
  grade: string;
  withAccount: number;
  pending: number;
  noAccount?: number;
  total?: number;
}

interface GradeRow {
  grade: string;
  label: string;
  withAccount: number;
  pending: number;
  noAccount: number;
  total: number;
}

function fetchBreakdown() {
  return apiClient
    .get<{ data: BreakdownGroup[] }>("/api/registrar/account-breakdown")
    .then((res) => res.data.data);
}

function formatGrade(grade: string) {
  return grade.startsWith("G") ? `Grade ${grade.slice(1)}` : grade;
}

export function OverviewGradeChart() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["registrar-account-breakdown"],
    queryFn: fetchBreakdown,
  });

  const rows: GradeRow[] = React.useMemo(() => {
    const map = new Map<string, GradeRow>();
    const groupTotal = (g: BreakdownGroup) =>
      g.total ?? g.withAccount + g.pending + (g.noAccount ?? 0);
    for (const g of data ?? []) {
      const noAccount = g.noAccount ?? 0;
      const total = groupTotal(g);
      const existing = map.get(g.grade);
      if (existing) {
        existing.withAccount += g.withAccount;
        existing.pending += g.pending;
        existing.noAccount += noAccount;
        existing.total += total;
      } else {
        map.set(g.grade, {
          grade: g.grade,
          label: formatGrade(g.grade),
          withAccount: g.withAccount,
          pending: g.pending,
          noAccount,
          total,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.grade.localeCompare(b.grade));
  }, [data]);

  const population = rows.reduce((s, r) => s + r.total, 0);

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle className={styles.title}>Students per Grade Level</CardTitle>
          <CardDescription className={styles.subtitle}>
            Current advisory population per grade — class lists accumulated, not
            account status.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className={styles.content}>
        {isPending ? (
          <Skeleton className={styles.skel} />
        ) : isError ? (
          <p className={styles.empty}>Could not load grade counts.</p>
        ) : rows.length === 0 ? (
          <p className={styles.empty}>No enrollments on record.</p>
        ) : (
          <>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rows}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                  barCategoryGap="28%"
                >
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    cursor={{
                      fill: "color-mix(in oklch, var(--foreground), transparent 95%)",
                    }}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Bar
                    dataKey="total"
                    name="Students"
                    radius={[6, 6, 0, 0]}
                    fill={TOTAL_COLOR}
                    maxBarSize={56}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className={styles.legend}>
              <li className={styles.legendItem}>
                <span
                  className={styles.dot}
                  style={{ backgroundColor: TOTAL_COLOR }}
                  aria-hidden
                />
                <span className={styles.legendLabel}>Students</span>
                <span className={styles.legendCount}>{population}</span>
              </li>
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
