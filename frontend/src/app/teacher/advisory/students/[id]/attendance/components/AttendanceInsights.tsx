"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MessageSquareText } from "lucide-react";
import type { AttendanceDay, AttendanceSummary } from "./attendance-data";
import styles from "./AttendanceInsights.module.css";

const SLICES = [
  { key: "present", label: "Present", color: "var(--success, #16a34a)" },
  { key: "absent", label: "Absent", color: "var(--destructive)" },
  { key: "late", label: "Late", color: "var(--warning, #d97706)" },
  { key: "excused", label: "Excused", color: "var(--muted-foreground)" },
] as const;

interface AttendanceInsightsProps {
  summary: AttendanceSummary | null;
  days: AttendanceDay[];
  loading: boolean;
}

function buildInterpretation(summary: AttendanceSummary, days: AttendanceDay[]): string[] {
  const lines: string[] = [];
  const pct = Math.round(summary.rate * 100);
  // Guard against stale payloads that predate the schoolDays field.
  const dayCount = summary.schoolDays ?? days.length;

  if (summary.total === 0) {
    return ["No school days have elapsed yet this term — nothing to interpret so far."];
  }

  lines.push(
    `${pct}% present across ${summary.total} possible sessions (${dayCount} school days).`
  );

  const issues: { label: string; count: number; advice: string }[] = [
    {
      label: "absences",
      count: summary.absent,
      advice: "Unexcused gaps break learning continuity — a parent check-in is warranted.",
    },
    {
      label: "late arrivals",
      count: summary.late,
      advice: "Tardiness is the pattern — mornings are the risk window.",
    },
    {
      label: "excused absences",
      count: summary.excused,
      advice: "Absences are mostly documented, but the missed time still accumulates.",
    },
  ];
  const top = issues.reduce((a, b) => (b.count > a.count ? b : a));
  if (top.count > 0) {
    lines.push(
      `${top.count} ${top.label} recorded — ${top.advice}`
    );
  } else {
    lines.push("No absences, lates, or excuses on record — clean sheet outside presences.");
  }

  // Recent trend: last 10 school days vs the term average.
  const recent = days.slice(0, 10);
  const recentSessions = recent.flatMap((d) => Object.values(d.sessions));
  if (recentSessions.length >= 5 && summary.total > 0) {
    const recentRate =
      recentSessions.filter((s) => s === "present").length / recentSessions.length;
    const diff = recentRate - summary.rate;
    if (diff > 0.05) lines.push("Trend is improving — recent days run above the term average.");
    else if (diff < -0.05) lines.push("Trend is slipping — recent days run below the term average.");
    else lines.push("Trend is steady — recent days match the term average.");
  }

  lines.push(
    summary.isRisk
      ? `At risk in attendance — ${pct}%, below the 80% threshold.`
      : "Not at risk — attendance on track."
  );

  return lines;
}

export function AttendanceInsights({ summary, days, loading }: AttendanceInsightsProps) {
  const series = useMemo(() => {
    if (!summary) return [];
    return SLICES.map((s) => ({ ...s, count: summary[s.key] }));
  }, [summary]);

  const lines = useMemo(
    () => (summary ? buildInterpretation(summary, days) : []),
    [summary, days]
  );
  // The status verdict is always the last line — render it as a badge.
  const hasStatusBadge = summary !== null && summary.total > 0 && lines.length > 0;
  const bodyLines = hasStatusBadge ? lines.slice(0, -1) : lines;
  const statusLine = hasStatusBadge ? lines[lines.length - 1] : null;

  if (loading || !summary) {
    return (
      <div className={styles.panel} aria-busy="true" aria-label="Loading attendance insights">
        <Skeleton className={styles.skelDonut} />
        <div className={styles.skelMessage}>
          <Skeleton className={styles.skelLine} />
          <Skeleton className={styles.skelLine} />
          <Skeleton className={styles.skelLineShort} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.chartCol}>
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={series}
                dataKey="count"
                nameKey="label"
                innerRadius="68%"
                outerRadius="100%"
                paddingAngle={1}
                stroke="none"
                isAnimationActive
                animationDuration={900}
              >
                {series.map((d) => (
                  <Cell key={d.key} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className={styles.center}>
            <span className={styles.centerValue}>{Math.round(summary.rate * 100)}%</span>
            <span className={styles.centerLabel}>present</span>
          </div>
        </div>
        <ul className={styles.legend}>
          {series.map((d) => (
            <li key={d.key} className={styles.legendItem}>
              <span className={styles.swatch} style={{ background: d.color }} />
              <span className={styles.legendLabel}>{d.label}</span>
              <span className={styles.legendValue}>{d.count}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.messageCol}>
        <p className={styles.messageHead}>
          <MessageSquareText className={styles.messageIcon} aria-hidden />
          What this means
        </p>
        <ul className={styles.messageList}>
          {bodyLines.map((line, i) => (
            <li key={i} className={styles.messageLine}>
              {line}
            </li>
          ))}
        </ul>
        {statusLine && summary ? (
          <Badge
            variant={summary.isRisk ? "destructive" : "success"}
            className={styles.statusBadge}
          >
            {statusLine}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
