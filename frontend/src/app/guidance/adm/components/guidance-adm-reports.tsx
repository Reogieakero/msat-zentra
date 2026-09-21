"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GuidanceAdmSummary } from "./guidance-adm-data";
import { GuidanceAdmTrend } from "./guidance-adm-trend";
import styles from "./guidance-adm-reports.module.css";

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
};

const ACTION_COLORS: Record<string, string> = {
  needs_review: "var(--chart-4)",
  booked_session: "var(--chart-3)",
  followup: "var(--chart-5)",
  endorsed: "var(--chart-1)",
  rejected: "var(--chart-2)",
};

const ACTION_TAKEAWAYS: Record<string, string> = {
  needs_review: "review each anecdotal, then endorse or reject it from the queue.",
  booked_session: "finish or cancel the booked sessions to move these cases along.",
  followup: "check back on their follow-up dates.",
  endorsed: "they now move with the ADM coordinator toward the parent meeting.",
  rejected: "they closed without further ADM action.",
};

function interpretActions(
  actions: { action: string; label: string; count: number }[],
  total: number
): string {
  if (total === 0) {
    return "No ADM cases referred to you yet — your actions will break down here by state.";
  }
  const ranked = [...actions].sort((a, b) => b.count - a.count);
  const top = ranked[0];
  const represented = actions.filter((a) => a.count > 0).length;
  const coverage =
    represented === 1
      ? "All referred cases sit in a single state."
      : `Actions span ${represented} of ${actions.length} states.`;
  return `${top.label} leads with ${top.count} of ${total} referred case${total === 1 ? "" : "s"} — ${ACTION_TAKEAWAYS[top.action] ?? ""} ${coverage}`;
}

/**
 * Referred-actions donut for the guidance ADM caseload, with a
 * plain-language read of what the mix means. Counts come from the full
 * guidance caseload (never any page filter).
 */
export function GuidanceAdmReports({ summary }: { summary: GuidanceAdmSummary }) {
  const actions = summary.byAction ?? [];
  const total = actions.reduce((m, a) => m + a.count, 0);

  return (
    <div className={styles.grid}>
    <Card className={styles.card}>
      <CardHeader>
        <CardTitle className={styles.sectionTitle}>Referred actions</CardTitle>
        <CardDescription className={styles.sectionDesc}>
          What you did with each referred ADM case.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className={styles.empty}>No ADM cases referred to you yet.</p>
        ) : (
          <div className={styles.split}>
            <div className={styles.donutWrap}>
              <ResponsiveContainer width="100%" height={168}>
                <PieChart>
                  <Pie
                    data={actions}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={70}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {actions.map((a) => (
                      <Cell key={a.action} fill={ACTION_COLORS[a.action] ?? "#737373"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.donutCenter}>
                <span className={styles.donutValue}>{total}</span>
                <span className={styles.donutCaption}>cases</span>
              </div>
            </div>
            <ul className={styles.legend}>
              {actions.map((a) => (
                <li key={a.action} className={styles.legendItem}>
                  <span className={styles.legendLabel}>
                    <span
                      className={styles.legendDot}
                      style={{ backgroundColor: ACTION_COLORS[a.action] ?? "#737373" }}
                      aria-hidden
                    />
                    {a.label}
                  </span>
                  <span className={styles.legendCount}>{a.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className={styles.interpretation} role="status">
          {interpretActions(actions, total)}
        </p>
      </CardContent>
    </Card>

      <GuidanceAdmTrend summary={summary} />
    </div>
  );
}
