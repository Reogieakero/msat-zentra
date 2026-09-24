"use client";

import * as React from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  NurseAdmActionCount,
  NurseAdmReferralsData,
} from "./nurse-adm-data";
import styles from "./nurse-adm.module.css";

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
};

const ACTION_COLORS: Record<string, string> = {
  needs_review: "var(--chart-4)",
  booked: "var(--chart-3)",
  followup: "var(--chart-5)",
  endorsed: "var(--chart-1)",
  done: "var(--chart-2)",
  rejected: "var(--chart-2)",
  escalated: "var(--destructive)",
};

const ACTION_TAKEAWAYS: Record<string, string> = {
  needs_review: "review each case, then endorse or reject it from the queue below.",
  booked: "finish or cancel the booked clinic sessions to move these cases along.",
  followup: "check back on their follow-up dates.",
  endorsed: "they now move with the ADM coordinator.",
  done: "their clinic sessions are done.",
  rejected: "they closed without further ADM action.",
  escalated: "they were sent higher up.",
};

function interpretActions(actions: NurseAdmActionCount[], total: number): string {
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
 * Referred-actions donut for the nurse ADM caseload, with a
 * plain-language read of what the mix means. Counts come from every
 * ADM case on the nurse's desk (never any page filter).
 */
function ReferredActions({ data }: { data: NurseAdmReferralsData }) {
  const { actions, total } = data;

  return (
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
  );
}

/**
 * Weekly line graph of ADM cases referred to the nurse over the last
 * 12 weeks. Counts come from every ADM case on the nurse's desk (never
 * any page filter).
 */
function ReferralTrend({ data }: { data: NurseAdmReferralsData }) {
  const weeks = data.trend;
  const total = weeks.reduce((m, w) => m + w.count, 0);
  const peak = weeks.reduce(
    (best, w) => (w.count > best.count ? w : best),
    { week: "", label: "—", count: 0 }
  );

  return (
    <Card className={styles.card}>
      <CardHeader>
        <CardTitle className={styles.sectionTitle}>ADM referred over time</CardTitle>
        <CardDescription className={styles.sectionDesc}>
          Cases referred to you per week — last 12 weeks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className={styles.empty}>No ADM referrals in the last 12 weeks.</p>
        ) : (
          <>
            <div className={styles.trendWrap}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weeks} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(label) => `Week of ${label}`}
                    formatter={(value) => [`${value} case${value === 1 ? "" : "s"}`, "Referred"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Referred"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "var(--primary)" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className={styles.interpretation} role="status">
              {total} case{total === 1 ? "" : "s"} referred in 12 weeks
              {peak.count > 0 ? ` — busiest week of ${peak.label} with ${peak.count}.` : "."}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function NurseAdmReports({ data }: { data: NurseAdmReferralsData }) {
  return (
    <div className={styles.grid}>
      <ReferredActions data={data} />
      <ReferralTrend data={data} />
    </div>
  );
}
