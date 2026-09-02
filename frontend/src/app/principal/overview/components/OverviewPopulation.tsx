"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Pie, PieChart, Cell } from "recharts";
import { Users } from "lucide-react";
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
  type ChartConfig,
} from "@/components/ui/chart";
import { fetchOverview, type OverviewSectionRow } from "./overview-data";
import styles from "./OverviewPopulation.module.css";

const chartConfig = {
  value: { label: "Students", color: "#2563eb" },
} satisfies ChartConfig;

const GRADE_ORDER = ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];

const GRADE_HUES: Record<string, number> = {
  "Grade 7": 215,
  "Grade 8": 150,
  "Grade 9": 38,
  "Grade 10": 275,
  "Grade 11": 8,
  "Grade 12": 190,
};

function colorFor(grade: string, index: number): string {
  const hue = GRADE_HUES[grade] ?? 215;
  const light = index === 0 ? 62 : index === 1 ? 50 : 38;
  return `hsl(${hue}, 60%, ${light}%)`;
}

interface GradeGroup {
  grade: string;
  total: number;
  rows: OverviewSectionRow[];
}

function interpretPopulation(rows: OverviewSectionRow[]): string {
  if (rows.length === 0) return "";
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const ranked = [...rows].sort((a, b) => b.count - a.count);
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  const avg = Math.round((total / rows.length) * 10) / 10;
  const parts: string[] = [
    `${total} students across ${rows.length} sections, averaging ${avg} per section.`,
  ];
  if (top.section !== bottom.section) {
    parts.push(
      `${top.section} carries the largest population at ${top.count}, while ${bottom.section} is the smallest at ${bottom.count}.`
    );
  }
  return parts.join(" ");
}

export function OverviewPopulation() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["overview"],
    queryFn: fetchOverview,
  });

  const groups: GradeGroup[] = React.useMemo(() => {
    const rows = data?.sections ?? [];
    const rowsByGrade = new Map<string, OverviewSectionRow[]>();
    for (const r of rows) {
      const list = rowsByGrade.get(r.grade) ?? [];
      list.push(r);
      rowsByGrade.set(r.grade, list);
    }
    return GRADE_ORDER.filter((g) => rowsByGrade.has(g)).map((g) => {
      const list = rowsByGrade.get(g) ?? [];
      return {
        grade: g,
        total: list.reduce((sum, r) => sum + r.count, 0),
        rows: list,
      };
    });
  }, [data]);

  const interpretation = React.useMemo(
    () => interpretPopulation(data?.sections ?? []),
    [data]
  );
  const totalEnrolled = React.useMemo(
    () => (data?.sections ?? []).reduce((sum, r) => sum + r.count, 0),
    [data]
  );

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Section populations</CardTitle>
          <CardDescription>
            Enrolled students per section for the active school year.
          </CardDescription>
        </div>
        <CardAction>
          {isPending ? (
            <Skeleton className={styles.headerBadgeSkel} />
          ) : (
            <Badge variant="secondary" className={styles.popBadge}>
              <Users className={styles.popIcon} aria-hidden />
              {totalEnrolled} enrolled
            </Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className={styles.content}>
        {isPending ? (
          <div className={styles.groupSkelWrap}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.groupSkel}>
                <Skeleton className={styles.groupSkelTitle} />
                <div className={styles.groupSkelBody}>
                  <Skeleton className={styles.groupSkelDonut} />
                  <div className={styles.groupSkelRows}>
                    {Array.from({ length: 3 }).map((_, j) => (
                      <Skeleton key={j} className={styles.groupSkelBar} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <p className={styles.empty}>Could not load section populations.</p>
        ) : groups.length === 0 ? (
          <p className={styles.empty}>No sections on file for the active school year.</p>
        ) : (
          <>
            <div className={styles.groups}>
              {groups.map((g) => (
                <div key={g.grade} className={styles.group}>
                  <div className={styles.groupHead}>
                    <h4 className={styles.groupTitle}>{g.grade}</h4>
                    <span className={styles.groupTotal}>{g.total} students</span>
                  </div>
                  <div className={styles.groupBody}>
                    <div className={styles.donutWrap}>
                      <ChartContainer config={chartConfig} className={styles.donut}>
                        <PieChart>
                          <Pie
                            data={g.rows}
                            dataKey="count"
                            nameKey="section"
                            cx="50%"
                            cy="50%"
                            innerRadius={34}
                            outerRadius={50}
                            paddingAngle={2}
                            strokeWidth={0}
                          >
                            {g.rows.map((r, i) => (
                              <Cell key={r.section} fill={colorFor(g.grade, i)} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                      <div className={styles.donutCenter}>
                        <span className={styles.donutTotal}>{g.total}</span>
                        <span className={styles.donutLabel}>students</span>
                      </div>
                    </div>
                    <ul className={styles.sectionList}>
                      {g.rows.map((r, i) => (
                        <li key={r.section} className={styles.sectionRow}>
                          <span
                            className={styles.sectionDot}
                            style={{ backgroundColor: colorFor(g.grade, i) }}
                            aria-hidden
                          />
                          <span className={styles.sectionName}>{r.section}</span>
                          <span className={styles.sectionCount}>{r.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
            {interpretation ? (
              <p className={styles.chartInterpretation}>{interpretation}</p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}