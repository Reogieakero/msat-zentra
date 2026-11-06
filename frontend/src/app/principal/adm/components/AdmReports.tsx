"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ClipboardList, PieChart as PieChartIcon, TrendingUp } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAdmDashboard } from "@/services/principal/adm.service";
import type { AdmDashboardTrendWeek, AdmStageCount } from "@/services/principal/adm.types";
import { useTerm } from "@/lib/term/TermContext";
import { AMBER_STEPS } from "../../../guidance/adm/components/guidance-adm-palette";
import { InsightCallout } from "@/components/ui/insight-callout";
import { GuidanceAdmNumberText } from "../../../guidance/adm/components/guidance-adm-number-text";
import styles from "../../../guidance/adm/components/guidance-adm-reports.module.css";

function BoardIcon({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <span className="text-primary" aria-hidden>
      <Icon size={14} />
    </span>
  );
}

/**
 * Card shell every ADM report tooltip uses — same border, spacing and amber
 * percentage across the stage gauge, section donut and cases-over-time line so
 * hovering any chart on the desk reads identically.
 */
function AdmTooltip({
  title,
  count,
  noun,
  pct,
}: {
  title: string;
  count: number;
  noun: "case" | "student";
  pct: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-card-foreground shadow-lg">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-muted-foreground">
        <span className="font-semibold text-foreground">{count}</span>{" "}
        {count === 1 ? noun : `${noun}s`} ·{" "}
        <span className="font-semibold text-amber-600 dark:text-amber-400">{pct}%</span>
      </p>
    </div>
  );
}

/** Stage/section row tooltip (gauge + donut). */
function StageTooltip({
  active,
  payload,
  total,
  noun = "case",
}: {
  active?: boolean;
  payload?: Array<{ payload?: AdmStageCount }>;
  total: number;
  noun?: "case" | "student";
}) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
  return <AdmTooltip title={row.short} count={row.count} noun={noun} pct={pct} />;
}

/** Cases-over-time tooltip — same card as the stage/section charts. */
function TrendTooltip({
  active,
  payload,
  label,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload?: AdmDashboardTrendWeek }>;
  label?: string | number;
  total: number;
}) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
  return (
    <AdmTooltip
      title={`Week of ${String(label ?? row.label)}`}
      count={row.count}
      noun="case"
      pct={pct}
    />
  );
}

export function AdmReports() {
  const { termReady } = useTerm();
  const { data, isPending } = useQuery({
    queryKey: ["adm-dashboard"],
    queryFn: ({ signal }) => fetchAdmDashboard(signal),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: termReady,
  });

  if (isPending || !data) {
    return (
      <div className={styles.threeCol} aria-busy="true" aria-label="Loading ADM reports">
        {[0, 1, 2].map((i) => (
          <KanbanBoard key={i} title={<Skeleton className="h-4 w-1/2" />}>
            <Skeleton className="h-40 w-full" />
          </KanbanBoard>
        ))}
      </div>
    );
  }

  const stages = data.stageBreakdown;
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  const top = [...stages].sort((a, b) => b.count - a.count)[0];
  const activeStages = [...stages]
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
  const trend = data.trend ?? [];
  const trendTotal = trend.reduce((sum, w) => sum + w.count, 0);

  // Section mix feeds the second donut — same shape as the stage rows so the
  // shared StageTooltip keeps working unchanged.
  const sections = (data.sectionBreakdown ?? [])
    .map((s) => ({ stage: s.section, short: s.section, count: s.count }))
    .sort((a, b) => b.count - a.count || a.short.localeCompare(b.short));
  const sectionTotal = sections.reduce((sum, s) => sum + s.count, 0);
  const activeSections = sections.filter((s) => s.count > 0);
  const peak = trend.reduce(
    (best, w) => (w.count > best.count ? w : best),
    { week: "", label: "—", count: 0 },
  );

  return (
    <div className={styles.threeCol}>
      <KanbanBoard
        title="Cases by stage"
        icon={<BoardIcon icon={ClipboardList} />}
        description={
          <span className="block min-h-8">
            School-wide ADM cases and where they sit in the pipeline.
          </span>
        }
        className="flex-1"
        footer={
          <div className="mt-auto">
            <InsightCallout>
              <GuidanceAdmNumberText>
                {top && top.count > 0
                  ? `${top.short} leads with ${top.count} of ${total} case${total === 1 ? "" : "s"} — clear the biggest group first.`
                  : "Stage mix will appear here once ADM cases are filed."}
              </GuidanceAdmNumberText>
            </InsightCallout>
          </div>
        }
      >
        {total === 0 ? (
          <p className={styles.empty}>No ADM cases yet.</p>
        ) : (
          <div className={styles.barChart} style={{ position: "relative" }}>
            <ResponsiveContainer width="100%" height={240}>
              <RadialBarChart
                data={activeStages}
                startAngle={90}
                endAngle={-270}
                innerRadius="42%"
                outerRadius="100%"
                barSize={14}
              >
                <RadialBar
                  dataKey="count"
                  background={{ fill: "var(--muted)" }}
                  cornerRadius={6}
                >
                  {activeStages.map((s, i) => (
                    <Cell key={s.stage} fill={AMBER_STEPS[i % AMBER_STEPS.length]} />
                  ))}
                </RadialBar>
                <Tooltip
                  cursor={false}
                  content={<StageTooltip total={total} />}
                  wrapperStyle={{ zIndex: 50 }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
              aria-hidden
            >
              <span className={styles.donutValue}>{total}</span>
              <span className={styles.donutCaption}>cases</span>
            </div>
          </div>
        )}
      </KanbanBoard>

      <KanbanBoard
        title="Section distribution"
        icon={<BoardIcon icon={PieChartIcon} />}
        description={
          <span className="block min-h-8">
            Share of ADM learners across the sections they belong to.
          </span>
        }
        className="flex-1"
        footer={
          <div className="mt-auto">
            <InsightCallout>
              <GuidanceAdmNumberText>
                {sectionTotal > 0
                  ? `${activeSections.length} of ${sections.length} sections hold ADM learners.`
                  : "Section shares will appear once cases exist."}
              </GuidanceAdmNumberText>
            </InsightCallout>
          </div>
        }
      >
        {sectionTotal === 0 ? (
          <p className={styles.empty}>No ADM cases yet.</p>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              minHeight: 240,
            }}
          >
            <div
              className={styles.donutWrap}
              style={{ width: "100%", maxWidth: 240, height: 240 }}
            >
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={activeSections}
                    dataKey="count"
                    nameKey="short"
                    cx="50%"
                    cy="50%"
                    innerRadius={64}
                    outerRadius={98}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {activeSections.map((s, i) => (
                      <Cell key={s.stage} fill={AMBER_STEPS[i % AMBER_STEPS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={false}
                    content={<StageTooltip total={sectionTotal} noun="student" />}
                    wrapperStyle={{ zIndex: 50 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.donutCenter}>
                <span className={styles.donutValue}>{sectionTotal}</span>
                <span className={styles.donutCaption}>students</span>
              </div>
            </div>
          </div>
        )}
      </KanbanBoard>

      <KanbanBoard
        title="Cases over time"
        icon={<BoardIcon icon={TrendingUp} />}
        description={
          <span className="block min-h-8">
            ADM cases filed per week — last 12 weeks.
          </span>
        }
        className="flex-1"
        footer={
          <div className="mt-auto">
            <InsightCallout>
              <GuidanceAdmNumberText>
                {trendTotal === 0
                  ? "No ADM cases filed in the last 12 weeks."
                  : `${trendTotal} case${trendTotal === 1 ? "" : "s"} filed in 12 weeks${peak.count > 0 ? ` — busiest week of ${peak.label} with ${peak.count}.` : "."}`}
              </GuidanceAdmNumberText>
            </InsightCallout>
          </div>
        }
      >
        {trendTotal === 0 ? (
          <p className={styles.empty}>No ADM cases in the last 12 weeks.</p>
        ) : (
          <div className={styles.trendWrap}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
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
                  cursor={{ stroke: "var(--border)" }}
                  content={<TrendTooltip total={trendTotal} />}
                  wrapperStyle={{ zIndex: 50 }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Filed"
                  stroke={AMBER_STEPS[0]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: AMBER_STEPS[0] }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </KanbanBoard>
    </div>
  );
}
