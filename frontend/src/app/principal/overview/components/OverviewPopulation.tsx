"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Pie, PieChart, Cell } from "recharts";
import { Users, ShieldAlert, Award } from "lucide-react";
import {
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { fetchOverview, type OverviewSectionRow } from "./overview-data";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { AuroraBanner } from "./AuroraBanner";
import styles from "./OverviewPopulation.module.css";

const chartConfig = {
  value: { label: "Students", color: "var(--primary)" },
} satisfies ChartConfig;

const GRADE_ORDER = ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];

// Primary-tinted steps, identical in light and dark mode: the principal's
// saved palette paints var(--primary) desk-wide, and mixing toward
// var(--card) keeps slices distinct on either surface.
const POPULATION_MIX = [100, 70, 45, 25];

function colorFor(index: number): string {
  const mix = POPULATION_MIX[index % POPULATION_MIX.length] ?? 100;
  return mix === 100
    ? "var(--primary)"
    : `color-mix(in oklch, var(--primary) ${mix}%, var(--card))`;
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

  // Grade-connected action banners: the grade carrying the heaviest at-risk
  // load, plus this term's Honor Roll qualifier count. Same ["overview"]
  // query as everything else on the page — no extra fetches.
  const spotlight = React.useMemo(() => {
    const rows = [...(data?.riskByGrade ?? [])].sort((a, b) => b.count - a.count);
    return rows.length > 0 && rows[0].count > 0 ? rows[0] : null;
  }, [data]);
  const honorCount = data?.honorRoll ?? 0;

  return (
    <section aria-label="Section populations" className={styles.section}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Section populations</CardTitle>
          <CardDescription>
            Enrolled students per section for the active school year.
          </CardDescription>
        </div>
        <div>
          {isPending ? (
            <Skeleton className={styles.headerBadgeSkel} />
          ) : (
            <Badge variant="secondary" className={styles.popBadge}>
              <Users className={styles.popIcon} aria-hidden />
              {totalEnrolled} enrolled
            </Badge>
          )}
        </div>
      </div>
      <div className={styles.content}>
        {isPending ? (
          <>
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
            <div className={styles.groups}>
              <Skeleton className={styles.bannerSkel} />
              <Skeleton className={styles.bannerSkel} />
            </div>
          </>
        ) : isError ? (
          <p className={styles.empty}>Could not load section populations.</p>
        ) : groups.length === 0 ? (
          <p className={styles.empty}>No sections on file for the active school year.</p>
        ) : (
          <>
            <div className={styles.groups}>
              {groups.map((g) => (
                <div key={g.grade} className={styles.group}>
                  <span className={assign.glowClip} aria-hidden="true">
                    <span className={assign.cardGlow} />
                  </span>
                  <div className={styles.groupHead}>
                    <h4 className={styles.groupTitle}>{g.grade}</h4>
                    <span className={styles.groupTotal}>{g.total} students</span>
                  </div>
                  <div className={styles.groupBody}>
                    <div className={styles.donutWrap}>
                      <ChartContainer config={chartConfig} className={styles.donut}>
                        <PieChart>
                          <ChartTooltip
                            wrapperStyle={{ zIndex: 50 }}
                            content={
                              <ChartTooltipContent
                                className={styles.tooltipSolid}
                                formatter={(value, name) => `${name}: ${value} student(s)`}
                              />
                            }
                          />
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
                              <Cell key={r.section} style={{ fill: colorFor(i) }} />
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
                            style={{ backgroundColor: colorFor(i) }}
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
              <AuroraBanner
                icon={ShieldAlert}
                pill="Grade spotlight"
                count={spotlight ? spotlight.count : 0}
                title={
                  spotlight
                    ? `${spotlight.grade} carries the heaviest at-risk load`
                    : "No at-risk learners this term"
                }
                cta="View risk board"
                href="/principal/risk"
                label={
                  spotlight
                    ? `Grade spotlight: ${spotlight.grade} has ${spotlight.count} at-risk students. View risk board.`
                    : "Grade spotlight: no at-risk learners this term. View risk board."
                }
              />
              <AuroraBanner
                icon={Award}
                pill="Honor Roll"
                count={honorCount}
                title={
                  honorCount === 1 ? "Qualifier this term" : "Qualifiers this term"
                }
                cta="View honor roll"
                href="/principal/honor-roll"
                label={`Honor Roll: ${honorCount} qualifiers this term. View honor roll.`}
              />
            </div>
            {interpretation ? (
              <p className={styles.chartInterpretation}>{interpretation}</p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}