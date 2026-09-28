"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Pie, PieChart, Cell } from "recharts";
import {
  ChevronRight,
  FileText,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { RecordStudent } from "../types";
import {
  CATEGORY_META,
  CATEGORY_KEYS,
  fetchRecords,
} from "./records-data";
import styles from "./RecordsOverview.module.css";

const chartConfig = {
  value: { label: "Records", color: "var(--chart-1)" },
} satisfies ChartConfig;

interface Kpi {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  value: string;
  suffix?: string;
  tone: "default" | "good" | "warn";
}

export function RecordsBreakdown() {
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

  const categoryTotal = categoryRows.reduce((s, r) => s + r.value, 0);

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

  const [attentionOpen, setAttentionOpen] = React.useState(false);

  React.useEffect(() => {
    if (!attentionOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAttentionOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [attentionOpen]);

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
  ];

  return (
    <>
    <Card className={`${styles.card} ${styles.narrow}`}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Anecdotal record breakdown</CardTitle>
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
              {categoryRows.map((row) => (
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
                </li>
              ))}
            </ul>

            {attention.length > 0 ? (
              <button
                type="button"
                className={styles.attentionBanner}
                onClick={() => setAttentionOpen(true)}
                aria-label="See needs attention list"
              >
                <TriangleAlert className={styles.attentionIcon} aria-hidden />
                <span className={styles.attentionBannerText}>
                  <span className={styles.attentionBannerTitle}>See needs attention list</span>
                  <span className={styles.attentionBannerSub}>
                    Students carrying the heaviest record load
                  </span>
                </span>
                <Badge variant="secondary" className={styles.attentionCount}>
                  {attention.length}
                </Badge>
                <ChevronRight className={styles.attentionGo} aria-hidden />
              </button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>

      {attentionOpen ? (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Needs attention"
          onClick={() => setAttentionOpen(false)}
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <h2 className={styles.modalTitle}>Needs attention</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setAttentionOpen(false)}
                aria-label="Close"
              >
                <X className={styles.modalCloseIcon} aria-hidden />
              </button>
            </div>
            <div className={styles.modalBody}>
              {attention.length === 0 ? (
                <p className={styles.empty}>No students with records this term.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.colLeft}>Student</th>
                        <th className={styles.colLeft}>Section</th>
                        <th>Records</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attention.map((s) => (
                        <tr key={s.lrn}>
                          <td className={styles.colLeft}>
                            <span className={styles.cellName}>{s.name}</span>
                            <span className={styles.cellSub}>{s.lrn}</span>
                          </td>
                          <td className={styles.colLeft}>{s.section}</td>
                          <td>
                            <Badge variant="secondary">{s.behavioral.length}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
