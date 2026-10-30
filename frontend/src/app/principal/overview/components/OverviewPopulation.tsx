"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Pie, PieChart, Cell } from "recharts";
import { Users } from "lucide-react";
import { PrincipalEmptyState } from "../../components/PrincipalEmptyCard";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { InsightCallout } from "@/components/ui/insight-callout";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { useTerm } from "@/lib/term/TermContext";
import { fetchOverview } from "@/services/principal/overview.service";
import type { OverviewSectionRow } from "@/services/principal/overview.types";
import { FriendlyTooltip } from "./overview-chart-tip";
import { CountUpNumber } from "./CountUpNumber";
import styles from "./OverviewPopulation.module.css";

const chartConfig = {
  count: { label: "Students", color: "#f59e0b" },
  value: { label: "Students", color: "#f59e0b" },
} satisfies ChartConfig;

const GRADE_ORDER = ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];

// Amber desk accent, stepped through the same mixes as the registry charts.
const AMBER = "#f59e0b";
const POPULATION_MIX = [100, 70, 45, 25];

function colorFor(index: number): string {
  const mix = POPULATION_MIX[index % POPULATION_MIX.length] ?? 100;
  return mix === 100 ? AMBER : `color-mix(in oklch, ${AMBER} ${mix}%, var(--card))`;
}

interface GradeGroup {
  grade: string;
  total: number;
  rows: OverviewSectionRow[];
}

function toCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function interpretPopulation(rows: OverviewSectionRow[]): string {
  if (rows.length === 0) return "";
  const total = rows.reduce((sum, r) => sum + toCount(r.count), 0);
  const ranked = [...rows].sort((a, b) => toCount(b.count) - toCount(a.count));
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  const avg = Math.round((total / rows.length) * 10) / 10;
  const parts: string[] = [
    `${total} students across ${rows.length} sections, averaging ${avg} per section.`,
  ];
  if (top.section !== bottom.section) {
    parts.push(
      `${top.section} carries the largest population at ${toCount(top.count)}, while ${bottom.section} is the smallest at ${toCount(bottom.count)}.`
    );
  }
  return parts.join(" ");
}

export function OverviewPopulation() {
  const { activeTerm } = useTerm();
  const { data, isPending, isError } = useQuery({
    queryKey: ["overview", activeTerm?.termId ?? null],
    queryFn: fetchOverview,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
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
      const list = (rowsByGrade.get(g) ?? []).map((r) => ({ ...r, count: toCount(r.count) }));
      return { grade: g, total: list.reduce((sum, r) => sum + r.count, 0), rows: list };
    });
  }, [data]);

  const interpretation = React.useMemo(
    () => interpretPopulation(data?.sections ?? []),
    [data]
  );
  const totalEnrolled = React.useMemo(
    () => (data?.sections ?? []).reduce((sum, r) => sum + toCount(r.count), 0),
    [data]
  );

  const populationEmpty = !data || groups.length === 0 || totalEnrolled === 0;

  const body = isPending ? (
    <div className={styles.groupSkelWrap}>
      {Array.from({ length: 6 }).map((_, i) => (
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
  ) : populationEmpty ? (
    <PrincipalEmptyState
      icon={Users}
      title="No adviser-shared sections"
      hint="No sections with adviser-shared learners were found for the active school year."
    />
  ) : (
    <>
      <div className={styles.groups}>
        {groups.map((g) => (
          <div key={g.grade} className={styles.group}>
            <div className={styles.groupHead}>
              <h4 className={styles.groupTitle}>{g.grade}</h4>
              <span className={styles.groupTotal}>
                <CountUpNumber value={g.total} /> students
              </span>
            </div>
            <div className={styles.groupBody}>
              <div className={styles.donutWrap}>
                <ChartContainer config={chartConfig} className={styles.donut}>
                  <PieChart>
                    <ChartTooltip
                      wrapperStyle={{ zIndex: 50 }}
                      content={<FriendlyTooltip unit="students" fallbackName="Section" />}
                    />
                    <Pie
                      data={g.rows}
                      dataKey="count"
                      nameKey="section"
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={42}
                      paddingAngle={2}
                      strokeWidth={0}
                      animationDuration={800}
                      animationBegin={100}
                      animationEasing="ease-out"
                    >
                      {g.rows.map((r, i) => (
                        <Cell key={r.section} style={{ fill: colorFor(i) }} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className={styles.donutCenter}>
                  <CountUpNumber className={styles.donutTotal} value={g.total} />
                  <span className={styles.donutLabel}>students</span>
                </div>
              </div>
              <ul className={styles.sectionList}>
                {g.rows.map((r, i) => (
                  <li key={r.section} className={styles.sectionRow}>
                    <span
                      className={styles.sectionDot}
                      style={{ backgroundColor: colorFor(i) }}
                      aria-hidden
                    />
                    <span className={styles.sectionName}>{r.section}</span>
                    <span className={styles.sectionCount}>{toCount(r.count)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
      {interpretation ? (
        <InsightCallout className="mt-auto">{interpretation}</InsightCallout>
      ) : null}
    </>
  );

  return (
    <KanbanBoard
      title="Section populations"
      icon={
        <span className={styles.accent} aria-hidden>
          <Users size={14} />
        </span>
      }
      description="Enrolled students per adviser-shared section for the active school year."
      actions={
        <Pill tone="green" label="Data source">
          Adviser-shared
        </Pill>
      }
    >
      <div className={styles.boardBody}>{body}</div>
    </KanbanBoard>
  );
}
