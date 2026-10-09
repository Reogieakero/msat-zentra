"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { PrincipalEmptyCard } from "../../components/PrincipalEmptyCard";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./RiskLevelDistribution.module.css";

const LEVEL_FILL: Record<"High" | "Moderate" | "Low", string> = {
  High: "var(--primary)",
  Moderate: "color-mix(in oklch, var(--primary) 60%, var(--card))",
  Low: "color-mix(in oklch, var(--primary) 30%, var(--card))",
};

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
  const { activeTerm } = useTerm();

  const { data, isPending } = useQuery({
    queryKey: ["risk-board", activeTerm?.termId ?? null, activeTerm?.schoolYearId ?? null],
    queryFn: async () => {
      const res = await apiClient.get<{
        byGrade: { grade: string; High: number; Moderate: number; Low: number; total: number }[];
      }>("/api/risk/board");
      return res.data;
    },
    staleTime: 15_000,
  });

  const byGrade = React.useMemo(() => {
    const map = new Map<
      number,
      { High: number; Moderate: number; Low: number; total: number }
    >();
    for (const g of data?.byGrade ?? []) {
      const n = gradeNum(g.grade);
      if (n < 7 || n > 12) continue;
      map.set(n, { High: g.High, Moderate: g.Moderate, Low: g.Low, total: g.total });
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [data]);

  const isEmpty = !isPending && byGrade.length === 0;
  return (
    <section className={styles.section} aria-busy={isPending || undefined}>
      {isPending ? (
        <>
          <Skeleton className="h-6 w-56" aria-hidden="true" />
          <div className={styles.grid} aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={assign.card}>
                <span className={assign.glowClip} aria-hidden="true">
                  <span className={assign.cardGlow} />
                </span>
                <div className={`${styles.cardHead} relative`}>
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-[104px] w-full rounded-full" />
                <ul className={`${styles.legend} relative`}>
                  {ORDERS.map((o) => (
                    <li key={o.level} className={styles.legendItem}>
                      <Skeleton className="size-2.5 shrink-0" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="ml-auto h-4 w-16 shrink-0" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      ) : (
      <>
      {isEmpty ? null : <h2 className={styles.sectionTitle}>Risk Level Distribution</h2>}

      {byGrade.length === 0 ? (
        <PrincipalEmptyCard
          icon={ShieldCheck}
          title="No students across grade levels"
          hint="No students found across grade levels for the active term."
        />
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
              <article key={grade} className={assign.card}>
                <span className={assign.glowClip} aria-hidden="true">
                  <span className={assign.cardGlow} />
                </span>
                <div className={`${styles.cardHead} relative`}>
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
                          style={{ fill: LEVEL_FILL[d.level] }}
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

                <ul className={`${styles.legend} relative`}>
                  {ORDERS.map((o) => (
                    <li key={o.level} className={styles.legendItem}>
                      <span
                        className={styles.swatch}
                        style={{ background: LEVEL_FILL[o.level] }}
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
      </>
      )}
    </section>
  );
}
