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
import { BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
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

function fetchBreakdown(): Promise<{ data: BreakdownGroup[] }> {
  return apiClient
    .get<{ data: BreakdownGroup[] }>("/api/record-keeper/account-breakdown")
    // The breakdown endpoint has returned non-array payloads in the wild
    // (cached/error shapes) — normalize to { data: [] } and never crash.
    // Object shape matches AccountBreakdown: both share this query key.
    .then((res) => ({ data: Array.isArray(res.data?.data) ? res.data.data : [] }));
}

function formatGrade(grade: string) {
  return grade.startsWith("G") ? `Grade ${grade.slice(1)}` : grade;
}

export function OverviewGradeChart() {
  const { data, isPending, isError } = useQuery({
    // Same dedicated overview key as AccountBreakdown above (shared cache,
    // same array payload) — never the accounts-page key.
    queryKey: ["record-keeper-overview-breakdown"],
    queryFn: fetchBreakdown,
    staleTime: 30_000,
  });

  const rows: GradeRow[] = React.useMemo(() => {
    const raw = data?.data;
    const list = Array.isArray(raw) ? raw : [];
    const map = new Map<string, GradeRow>();
    const groupTotal = (g: BreakdownGroup) =>
      g.total ?? g.withAccount + g.pending + (g.noAccount ?? 0);
    for (const g of list) {
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
    <section className={assign.card} aria-labelledby="overview-students-grade">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className={`${styles.header} relative`}>
        <div className={styles.headerText}>
          <h2 id="overview-students-grade" className="text-base font-semibold">Students per Grade Level</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Current advisory population per grade — class lists accumulated, not
            account status.
          </p>
        </div>
      </div>
      <div className={`${styles.content} relative`}>
        {isPending ? (
          <Skeleton className={styles.skel} />
        ) : isError ? (
          <p className={styles.empty}>Could not load grade counts.</p>
        ) : rows.length === 0 ? (
          <div className={styles.emptyBlock}>
            <span className={styles.emptyIcon} aria-hidden>
              <BarChart3 />
            </span>
            <p className={styles.emptyTitle}>No enrollments yet</p>
            <p className={styles.emptyHint}>
              Grade-level counts appear once students are enrolled.
            </p>
          </div>
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
      </div>
    </section>
  );
}
