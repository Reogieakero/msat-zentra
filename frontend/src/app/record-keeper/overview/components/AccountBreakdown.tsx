"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts";
import { GraduationCap } from "lucide-react";
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
import { apiClient } from "@/lib/api/client";
import styles from "./AccountBreakdown.module.css";

const ACTIVE_COLOR = "#16a34a";
const PENDING_COLOR = "#f59e0b";

interface BreakdownGroup {
  id: string;
  label: string;
  grade: string;
  withAccount: number;
  pending: number;
}

interface BreakdownResponse {
  data: BreakdownGroup[];
}

function fetchBreakdown() {
  return apiClient
    .get<BreakdownResponse>("/api/record-keeper/account-breakdown")
    .then((res) => res.data)
    .catch((err) => {
      console.error("[/api/record-keeper/account-breakdown] fetch failed:", err);
      throw err;
    });
}

interface GradeCardProps {
  grade: string;
  groups: BreakdownGroup[];
}

function GradeCard({ grade, groups }: GradeCardProps) {
  const active = groups.reduce((s, g) => s + g.withAccount, 0);
  const pending = groups.reduce((s, g) => s + g.pending, 0);
  const total = active + pending;
  const activePct = total === 0 ? 0 : Math.round((active / total) * 100);
  const pendingPct = 100 - activePct;

  const series = [
    { name: "With account", value: activePct, fill: ACTIVE_COLOR },
    { name: "Pending sign-up", value: pendingPct, fill: PENDING_COLOR },
  ];

  return (
    <article className={styles.gradeCard}>
      <div className={styles.gradeHead}>
        <span className={styles.gradeIcon} aria-hidden>
          <GraduationCap className={styles.gradeIconSvg} />
        </span>
        <div className={styles.gradeBody}>
          <h3 className={styles.gradeTitle}>Grade {grade.replace("G", "")}</h3>
          <ul className={styles.gradeMeta}>
            <li className={styles.gradeMetaItem}>
              {groups.length} section{groups.length !== 1 ? "s" : ""}
            </li>
            <li className={styles.gradeMetaItem}>{total} enrolled</li>
          </ul>
        </div>
      </div>

      <div className={styles.gauge}>
        {total === 0 ? (
          <p className={styles.empty}>No enrollments on record.</p>
        ) : (
          <>
            <div className={styles.gaugeWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="100%"
                  barSize={14}
                  data={series}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar
                    dataKey="value"
                    cornerRadius={10}
                    background={{ fill: "color-mix(in oklch, var(--foreground), transparent 92%)" }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.legend}>
              <div className={styles.legendEntry}>
                <span
                  className={styles.legendSwatch}
                  style={{ backgroundColor: ACTIVE_COLOR }}
                  aria-hidden
                />
                <div className={styles.legendBody}>
                  <div className={styles.legendLine}>
                    <span className={styles.legendPercent}>{activePct}%</span>
                    <span className={styles.legendLabel}> - With account</span>
                  </div>
                  <p className={styles.legendCount}>
                    {active} student{active !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className={styles.legendEntry}>
                <span
                  className={styles.legendSwatch}
                  style={{ backgroundColor: PENDING_COLOR }}
                  aria-hidden
                />
                <div className={styles.legendBody}>
                  <div className={styles.legendLine}>
                    <span className={styles.legendPercent}>{pendingPct}%</span>
                    <span className={styles.legendLabel}> - Pending sign-up</span>
                  </div>
                  <p className={styles.legendCount}>
                    {pending} student{pending !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

export function AccountBreakdown() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["record-keeper-account-breakdown"],
    queryFn: fetchBreakdown,
  });

  const groups = React.useMemo(() => data?.data ?? [], [data]);

  const byGrade = React.useMemo(() => {
    const map = new Map<string, BreakdownGroup[]>();
    for (const g of groups) {
      if (!map.has(g.grade)) map.set(g.grade, []);
      map.get(g.grade)!.push(g);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [groups]);

  const totals = React.useMemo(() => {
    const active = groups.reduce((s, g) => s + g.withAccount, 0);
    const pending = groups.reduce((s, g) => s + g.pending, 0);
    return { active, pending, total: active + pending };
  }, [groups]);

  const coverage =
    totals.total === 0 ? 0 : Math.round((totals.active / totals.total) * 100);

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Account Breakdown</CardTitle>
          <CardDescription>
            Active-year roster vs sign-up status, per grade and section for the band.
          </CardDescription>
        </div>
        <CardAction>
          {isPending ? (
            <Badge variant="warning" className={styles.pendingBadge}>
              …
            </Badge>
          ) : (
            <Badge variant="warning" className={styles.pendingBadge}>
              {totals.pending} pending
            </Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className={styles.content}>
        {isPending ? (
          <div className={styles.skelWrap}>
            <Skeleton className={styles.skelTiles} />
            <div className={styles.gradeGrid}>
              <Skeleton className={styles.skelGrade} />
              <Skeleton className={styles.skelGrade} />
            </div>
          </div>
        ) : isError ? (
          <p className={styles.empty}>Could not load the account breakdown.</p>
        ) : (
          <>
            <div className={styles.tiles}>
              <div className={styles.tile}>
                <span className={styles.tileLabel}>With account</span>
                <span className={styles.tileValue}>{totals.active}</span>
              </div>
              <div className={styles.tile}>
                <span className={styles.tileLabel}>Pending sign-up</span>
                <span className={styles.tileValue}>{totals.pending}</span>
              </div>
              <div className={styles.tile}>
                <span className={styles.tileLabel}>Enrolled</span>
                <span className={styles.tileValue}>{totals.total}</span>
              </div>
            </div>

            {byGrade.length === 0 ? (
              <p className={styles.empty}>
                No roster entries for the grade band this school year.
              </p>
            ) : (
              <div className={styles.gradeGrid}>
                {byGrade.map(([grade, gradeGroups]) => (
                  <GradeCard key={grade} grade={grade} groups={gradeGroups} />
                ))}
              </div>
            )}

            <p className={styles.footnote}>
              {coverage}% of enrolled students already have an active account. Pending
              counts reconcile with the Pending Approvals list above.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}