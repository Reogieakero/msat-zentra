"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { apiClient } from "@/lib/api/client";
import { useGradeMode } from "../../grade-mode-context";
import { RISK_LEVEL_COLORS } from "../riskData";
import type { BackendStudent } from "../students/api";
import styles from "./RiskLevelDistribution.module.css";

const ORDERS: { level: "High" | "Moderate" | "Low"; label: string }[] = [
  { level: "High", label: "High risk" },
  { level: "Moderate", label: "Moderate" },
  { level: "Low", label: "Low risk" },
];

const gradeNum = (name: string) => {
  const m = String(name).match(/(\d+)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? 0 : n;
};

export function RiskLevelDistribution() {
  const { gradeMode } = useGradeMode();

  const { data, isPending } = useQuery({
    queryKey: ["risk-students", gradeMode],
    queryFn: async () => {
      const res = await apiClient.get<{
        students: BackendStudent[];
        total: number;
      }>("/api/risk/students", {
        params: { pageSize: 1000, gradeMode },
      });
      return res.data;
    },
  });

  const byGrade = React.useMemo(() => {
    const map = new Map<
      number,
      { High: number; Moderate: number; Low: number; total: number }
    >();
    for (const s of data?.students ?? []) {
      const g = gradeNum(s.section);
      if (g < 7 || g > 12) continue;
      if (!map.has(g)) map.set(g, { High: 0, Moderate: 0, Low: 0, total: 0 });
      const e = map.get(g)!;
      e[s.riskLevel]++;
      e.total++;
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [data]);

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Risk Level Distribution</h2>

      {isPending ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      ) : byGrade.length === 0 ? (
        <p className={styles.empty}>No students found across grade levels.</p>
      ) : (
        <div className={styles.grid}>
          {byGrade.map(([grade, e]) => {
            const series = ORDERS.map((o) => ({
              level: o.level,
              count: e[o.level] as number,
            }));
            const pct = (n: number) =>
              e.total === 0 ? 0 : Math.round((n / e.total) * 100);
            return (
              <article key={grade} className={styles.card}>
                <div className={styles.cardHead}>
                  <h3 className={styles.cardTitle}>Grade {grade}</h3>
                  <span className={styles.cardTotal}>{e.total} students</span>
                </div>

                <div className={styles.chartWrap}>
                  <ResponsiveContainer width="100%" height={104}>
                    <PieChart>
                      <Pie
                        data={series}
                        dataKey="count"
                        nameKey="level"
                        innerRadius="66%"
                        outerRadius="100%"
                        paddingAngle={1}
                        stroke="none"
                        isAnimationActive
                        animationDuration={800}
                      >
                        {series.map((d) => (
                          <Cell
                            key={d.level}
                            fill={RISK_LEVEL_COLORS[d.level]}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className={styles.center}>
                    <span className={styles.centerValue}>
                      {e.total.toLocaleString()}
                    </span>
                    <span className={styles.centerLabel}>total</span>
                  </div>
                </div>

                <ul className={styles.legend}>
                  {ORDERS.map((o) => (
                    <li key={o.level} className={styles.legendItem}>
                      <span
                        className={styles.swatch}
                        style={{ background: RISK_LEVEL_COLORS[o.level] }}
                      />
                      <span className={styles.legendLabel}>{o.label}</span>
                      <span className={styles.legendValue}>
                        {`${e[o.level]} (${pct(e[o.level] as number)}%)`}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
