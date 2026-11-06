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
import { ClipboardList, PieChart as PieChartIcon, TrendingUp } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { AdmInterpretation } from "./NurseAdmInterpretation";
import { AdmValuePill } from "./NurseAdmValuePill";
import { AMBER, AMBER_STEPS } from "./nurse-adm-palette";
import type {
  NurseAdmActionCount,
  NurseAdmInsightsData,
  NurseAdmReferralsData,
} from "@/services/nurse/adm.reports";
import styles from "./nurse-adm.module.css";

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
};

const ACTION_COLORS: Record<string, string> = {
  needs_review: AMBER_STEPS[0],
  endorsed: AMBER_STEPS[1],
  booked: AMBER_STEPS[2],
  followup: AMBER_STEPS[3],
  done: AMBER_STEPS[4],
  rejected: AMBER_STEPS[5],
  escalated: AMBER_STEPS[6],
};

const ACTION_TAKEAWAYS: Record<string, string> = {
  needs_review: "review each case, then endorse or reject it from the ADM timeline.",
  booked: "finish or cancel the booked clinic sessions to move these cases along.",
  followup: "check back on their follow-up dates.",
  endorsed: "they now move with the ADM coordinator.",
  done: "their clinic sessions are done.",
  rejected: "they closed without further ADM action.",
  escalated: "they were sent higher up.",
};

function interpretActions(actions: NurseAdmActionCount[], total: number): string {
  if (total === 0) {
    return "No referrals on your desk yet — case states will break down here.";
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

function CasesByCategory({ data }: { data: NurseAdmInsightsData }) {
  const top = data.categories[0] ?? null;
  return (
    <KanbanBoard
      title="Cases by category"
      icon={
        <span className="text-primary" aria-hidden>
          <ClipboardList size={14} />
        </span>
      }
      count={data.total}
      description="What the referred anecdotes were filed as."
      className="flex-1"
      footer={
        <AdmInterpretation>
          {top
            ? `${top.label} leads with ${top.count} of ${data.total} case${data.total === 1 ? "" : "s"} (${top.share}%) — start follow-through with the largest group first.`
            : "Category mix will appear here once cases are referred to you."}
        </AdmInterpretation>
      }
    >
      {data.categories.length === 0 ? (
        <p className={styles.empty}>No categorized cases yet.</p>
      ) : (
        <ul className={styles.categoryList}>
          {data.categories.map((c, i) => (
            <li key={c.key} className={styles.categoryRow}>
              <span className={styles.categoryHead}>
                <span
                  className={styles.legendDot}
                  style={{
                    backgroundColor: AMBER_STEPS[i % AMBER_STEPS.length],
                  }}
                  aria-hidden
                />
                {c.label}
              </span>
              <span className={styles.categoryBar} aria-hidden>
                <span
                  className={styles.categoryFill}
                  style={{
                    width: `${c.share}%`,
                    backgroundColor: AMBER_STEPS[i % AMBER_STEPS.length],
                  }}
                />
              </span>
              <span className={styles.legendCount}>
                <AdmValuePill count={c.count} percent={c.share} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </KanbanBoard>
  );
}

function ReferredActions({ data }: { data: NurseAdmReferralsData }) {
  const { actions, total } = data;

  return (
    <KanbanBoard
      title="Referred actions"
      icon={
        <span className="text-primary" aria-hidden>
          <PieChartIcon size={14} />
        </span>
      }
      count={total}
      description="What happened with each case referred to you."
      className="flex-1"
      footer={
        <AdmInterpretation>{interpretActions(actions, total)}</AdmInterpretation>
      }
    >
      {total === 0 ? (
        <p className={styles.empty}>No referrals on your desk yet.</p>
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
                <Tooltip
                  cursor={false}
                  wrapperStyle={{ zIndex: 50 }}
                  content={({ active, payload }) => {
                    const row = active
                      ? (payload?.[0]?.payload as NurseAdmActionCount | undefined)
                      : undefined;
                    if (!row) return null;
                    const pct =
                      total > 0 ? Math.round((row.count / total) * 100) : 0;
                    return (
                      <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-card-foreground shadow-lg">
                        <p className="font-semibold">{row.label}</p>
                        <p className="mt-1 text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {row.count}
                          </span>{" "}
                          {row.count === 1 ? "case" : "cases"} ·{" "}
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {pct}%
                          </span>
                        </p>
                      </div>
                    );
                  }}
                />
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
                <span className={styles.legendCount}>
                  <AdmValuePill
                    count={a.count}
                    percent={total > 0 ? Math.round((a.count / total) * 100) : 0}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </KanbanBoard>
  );
}

function ReferralTrend({ data }: { data: NurseAdmReferralsData }) {
  const weeks = data.trend;
  const total = weeks.reduce((m, w) => m + w.count, 0);
  const peak = weeks.reduce(
    (best, w) => (w.count > best.count ? w : best),
    { week: "", label: "—", count: 0 }
  );

  return (
    <KanbanBoard
      title="Referrals over time"
      icon={
        <span className="text-primary" aria-hidden>
          <TrendingUp size={14} />
        </span>
      }
      count={total}
      description="Cases referred to you per week — last 12 weeks."
      className="flex-1"
      footer={
        <AdmInterpretation>
          {`${total} case${total === 1 ? "" : "s"} referred in 12 weeks${
            peak.count > 0 ? ` — busiest week of ${peak.label} with ${peak.count}.` : "."
          }`}
        </AdmInterpretation>
      }
    >
      {total === 0 ? (
        <p className={styles.empty}>No referrals in the last 12 weeks.</p>
      ) : (
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
                stroke={AMBER}
                strokeWidth={2}
                dot={{ r: 3, fill: AMBER }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </KanbanBoard>
  );
}

export function NurseAdmReports({
  data,
  insights,
}: {
  data: NurseAdmReferralsData;
  insights: NurseAdmInsightsData;
}) {
  return (
    <div className={styles.threeCol}>
      <CasesByCategory data={insights} />
      <ReferredActions data={data} />
      <ReferralTrend data={data} />
    </div>
  );
}
