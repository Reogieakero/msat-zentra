import * as React from "react";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  type PanelDef,
  type ReportsPayload,
} from "../reports-data";
import styles from "./reports-panels.module.css";

const CHART_CONFIG = {
  avgTransmuted: { label: "Avg Transmuted" },
  candidates: { label: "Candidates" },
  count: { label: "Cases" },
  rate: { label: "Attendance %" },
  referred: { label: "Referred" },
  resolved: { label: "Resolved" },
  ongoing: { label: "Ongoing" },
  unresolved: { label: "Unresolved" },
} as const;

const LIST_COLORS = [
  "var(--primary)",
  "var(--accent-foreground)",
  "var(--muted-foreground)",
];

function PanelMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className={styles.interpretation}>
      <span className={styles.interpretationLabel}>What it means · </span>
      {children}
    </p>
  );
}

function PanelFrame({
  title,
  hint,
  children,
  banner,
  action,
  message,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
  banner?: string;
  action?: React.ReactNode;
  message?: React.ReactNode;
}) {
  return (
    <Card className={styles.panel}>
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      <CardHeader className={styles.panelHead}>
        <div>
          <CardTitle className={styles.panelTitle}>{title}</CardTitle>
          <span className={styles.panelHint}>{hint}</span>
        </div>
        {action ? <div className={styles.panelAction}>{action}</div> : null}
      </CardHeader>
      <CardContent className={styles.panelContent}>
        {banner ? (
          <div className={styles.banner}>
            <Info size={14} />
            {banner}
          </div>
        ) : null}
        {children}
        {message ? <PanelMessage>{message}</PanelMessage> : null}
      </CardContent>
    </Card>
  );
}

function MiniLine({ data }: { data: { term: string; avgTransmuted: number }[] }) {
  return (
    <ChartContainer config={CHART_CONFIG} className={styles.chartMini}>
      <LineChart data={data}>
        <XAxis dataKey="term" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis domain={[70, 90]} tickLine={false} axisLine={false} fontSize={11} hide />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          type="monotone"
          dataKey="avgTransmuted"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={{ r: 2.5 }}
        />
      </LineChart>
    </ChartContainer>
  );
}

function MiniBar({
  data,
  dataKey,
  labelKey,
  height = 150,
  hideLabels = false,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  labelKey: string;
  height?: number;
  hideLabels?: boolean;
}) {
  const horizontal = labelKey !== "grade" && labelKey !== "section" && labelKey !== "action" && labelKey !== "category";
  return (
    <ChartContainer config={CHART_CONFIG} className={styles.chartMini} style={{ height }}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"}>
        <XAxis
          type={horizontal ? "number" : "category"}
          dataKey={horizontal ? undefined : labelKey}
          tickLine={false}
          axisLine={false}
          fontSize={10}
        />
        <YAxis
          type={horizontal ? "category" : "number"}
          dataKey={horizontal ? labelKey : undefined}
          tickLine={false}
          axisLine={false}
          fontSize={10}
          width={horizontal ? 84 : undefined}
          height={horizontal ? undefined : 8}
          hide={horizontal ? hideLabels : undefined}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar
          dataKey={dataKey}
          fill="var(--primary)"
          radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          barSize={horizontal ? 12 : 14}
        />
      </BarChart>
    </ChartContainer>
  );
}

function StackedMini({
  data,
}: {
  data: { grade: string; referred: number; resolved: number; ongoing: number; unresolved: number }[];
}) {
  return (
    <ChartContainer config={CHART_CONFIG} className={styles.chartMini} style={{ height: 150 }}>
      <BarChart data={data}>
        <XAxis dataKey="grade" tickLine={false} axisLine={false} fontSize={10} />
        <YAxis tickLine={false} axisLine={false} fontSize={10} hide />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="resolved" stackId="a" fill="var(--primary)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="ongoing" stackId="a" fill="var(--accent)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="unresolved" stackId="a" fill="var(--border)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

const RISK_COLORS: Record<string, string> = {
  High: "#171717",
  Moderate: "#6b7280",
  Low: "#d1d5db",
};

function Donut({
  data,
  labelKey,
  valueKey,
}: {
  data: Record<string, string | number>[];
  labelKey: string;
  valueKey: string;
}) {
  const total = data.reduce((a, d) => a + Number(d[valueKey]), 0);
  return (
    <div className={styles.donutWrap}>
      <ChartContainer config={CHART_CONFIG} className={styles.chartMini} style={{ height: 150, width: 150 }}>
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey={labelKey} />} />
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={labelKey}
            innerRadius={42}
            outerRadius={62}
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
          >
            {data.map((d) => (
              <Cell key={d[labelKey] as string} fill={RISK_COLORS[d[labelKey] as string] ?? "var(--primary)"} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className={styles.donutLegend}>
        {data.map((d) => (
          <li key={d[labelKey] as string} className={styles.donutLegendItem}>
            <span
              className={styles.donutSwatch}
              style={{ background: RISK_COLORS[d[labelKey] as string] ?? "var(--primary)" }}
            />
            <span className={styles.donutLabel}>{d[labelKey] as string}</span>
            <span className={styles.donutValue}>
              {d[valueKey] as number}
              <span className={styles.donutPct}>
                {total ? Math.round((Number(d[valueKey]) / total) * 100) : 0}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListPanel({
  rows,
  labelKey,
  valueKey,
}: {
  rows: Record<string, string | number>[];
  labelKey: string;
  valueKey: string;
}) {
  const max = Math.max(...rows.map((r) => Number(r[valueKey])));
  return (
    <ul className={styles.list}>
      {rows.map((r, i) => (
        <li key={r[labelKey] as string} className={styles.listRow}>
          <span
            className={styles.listDot}
            style={{ background: LIST_COLORS[i % LIST_COLORS.length] }}
          />
          <span className={styles.listLabel}>{r[labelKey] as string}</span>
          <span className={styles.listBarTrack}>
            <span
              className={styles.listBarFill}
              style={{
                width: `${max ? (Number(r[valueKey]) / max) * 100 : 0}%`,
                background: LIST_COLORS[i % LIST_COLORS.length],
              }}
            />
          </span>
          <span className={styles.listValue}>{r[valueKey] as number}</span>
        </li>
      ))}
    </ul>
  );
}

function AdmStagesCards({ rows }: { rows: { stage: string; count: number }[] }) {
  return (
    <div className={styles.kpiGrid}>
      {rows.map((s) => (
        <div key={s.stage} className={`${styles.kpiCard} ${styles.miniGlow}`}>
          <span className={styles.glowClip} aria-hidden="true">
            <span className={styles.cardGlow} />
          </span>
          <span className={styles.kpiCardValue}>{s.count}</span>
          <span className={styles.kpiCardLabel}>{s.stage}</span>
        </div>
      ))}
    </div>
  );
}

function AccountsPanel({ rows }: { rows: { band: string; pending: number }[] }) {
  const total = rows.reduce((a, b) => a + b.pending, 0);
  return (
    <div className={styles.statWrap}>
      <span className={styles.statValue}>{total}</span>
      <span className={styles.statLabel}>accounts pending approval</span>
      <ul className={styles.statList}>
        {rows.map((a) => (
          <li key={a.band} className={styles.statRow}>
            <span>{a.band}</span>
            <Badge variant="secondary">{a.pending}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState() {
  return <p className={styles.empty}>No data for the selected scope.</p>;
}

export function ReportPanel({
  panel,
  data,
}: {
  panel: PanelDef;
  data: ReportsPayload;
}) {
  switch (panel.id) {
    case "trends": {
      const first = data.trends[0]?.avgTransmuted;
      const last = data.trends[data.trends.length - 1]?.avgTransmuted;
      const diff = first != null && last != null ? last - first : 0;
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          banner={data.trends.length ? "Live data — snapshot regenerating." : undefined}
          message={
            data.trends.length > 1 ? (
              diff > 0 ? (
                <>Average climbing from {first} to {last} across the plotted terms.</>
              ) : diff < 0 ? (
                <>Average slipping from {first} to {last} across the plotted terms.</>
              ) : (
                <>Average holding steady at {last} across the plotted terms.</>
              )
            ) : undefined
          }
        >
          {data.trends.length ? (
            <MiniLine data={data.trends} />
          ) : (
            <EmptyState />
          )}
        </PanelFrame>
      );
    }
    case "honor_roll": {
      const total = data.honorRollByGrade.reduce((s, r) => s + r.candidates, 0);
      const top = [...data.honorRollByGrade].sort((a, b) => b.candidates - a.candidates)[0];
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          message={
            top ? (
              <>Highest: {top.grade} with {top.candidates} of {total} candidates.</>
            ) : undefined
          }
        >
          {data.honorRollByGrade.length ? (
            <MiniBar data={data.honorRollByGrade} dataKey="candidates" labelKey="grade" />
          ) : (
            <EmptyState />
          )}
        </PanelFrame>
      );
    }
    case "adm_stages": {
      const total = data.admStages.reduce((a, s) => a + s.count, 0);
      const top = [...data.admStages].sort((a, b) => b.count - a.count)[0];
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          action={
            <span className={styles.totalBadge}>
              <span className={styles.totalBadgeValue}>{total}</span>
              <span className={styles.totalBadgeLabel}>Total Active</span>
            </span>
          }
          message={
            top ? (
              <>{total} active cases, most sitting in {top.stage} ({top.count}).</>
            ) : undefined
          }
        >
          {data.admStages.length ? <AdmStagesCards rows={data.admStages} /> : <EmptyState />}
        </PanelFrame>
      );
    }
    case "adm_eligibility": {
      const total = data.admEligibility.reduce((a, r) => a + Number(r.count), 0);
      const eligible = data.admEligibility.find(
        (r) => String(r.status).toLowerCase() === "eligible"
      );
      const eligibleCount = eligible ? Number(eligible.count) : 0;
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          message={
            total > 0 ? (
              <>{eligibleCount} of {total} cases eligible ({Math.round((eligibleCount / total) * 100)}%).</>
            ) : undefined
          }
        >
          {data.admEligibility.length ? (
            <ListPanel rows={data.admEligibility} labelKey="status" valueKey="count" />
          ) : (
            <EmptyState />
          )}
        </PanelFrame>
      );
    }
    case "risk_distribution": {
      const total = data.riskDistribution.reduce((a, r) => a + Number(r.count), 0);
      const at = (level: string) =>
        Number(data.riskDistribution.find((r) => r.level === level)?.count ?? 0);
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          message={
            total > 0 ? (
              <>{at("High") + at("Moderate")} of {total} students flagged (High {at("High")} · Moderate {at("Moderate")} · Low {at("Low")}).</>
            ) : undefined
          }
        >
          {data.riskDistribution.length ? (
            <Donut data={data.riskDistribution} labelKey="level" valueKey="count" />
          ) : (
            <EmptyState />
          )}
        </PanelFrame>
      );
    }
    case "intervention": {
      const referred = data.interventionSuccess.reduce((s, r) => s + r.referred, 0);
      const resolved = data.interventionSuccess.reduce((s, r) => s + r.resolved, 0);
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          message={
            referred > 0 ? (
              <>{resolved} of {referred} referred resolved ({Math.round((resolved / referred) * 100)}% success).</>
            ) : undefined
          }
        >
          {data.interventionSuccess.length ? (
            <StackedMini data={data.interventionSuccess} />
          ) : (
            <EmptyState />
          )}
        </PanelFrame>
      );
    }
    case "attendance_watch": {
      const lowest = [...data.attendanceWatch].sort((a, b) => a.rate - b.rate)[0];
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          message={
            lowest ? (
              <>Lowest: {lowest.section} at {lowest.rate}% present — below the 80% mark.</>
            ) : undefined
          }
        >
          {data.attendanceWatch.length ? (
            <MiniBar data={data.attendanceWatch} dataKey="rate" labelKey="section" hideLabels />
          ) : (
            <EmptyState />
          )}
        </PanelFrame>
      );
    }
    case "audit": {
      const top = [...data.auditActivity].sort((a, b) => b.count - a.count)[0];
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          message={
            top ? (
              <>Most frequent: {top.action} ({top.count} events).</>
            ) : undefined
          }
        >
          {data.auditActivity.length ? (
            <MiniBar data={data.auditActivity} dataKey="count" labelKey="action" />
          ) : (
            <EmptyState />
          )}
        </PanelFrame>
      );
    }
    case "anecdotal": {
      const top = [...data.anecdotalCategories].sort((a, b) => b.count - a.count)[0];
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          message={
            top ? (
              <>Most filed: {top.category} ({top.count} records).</>
            ) : undefined
          }
        >
          {data.anecdotalCategories.length ? (
            <MiniBar data={data.anecdotalCategories} dataKey="count" labelKey="category" />
          ) : (
            <EmptyState />
          )}
        </PanelFrame>
      );
    }
    case "accounts": {
      const total = data.accountApprovals.reduce((s, r) => s + r.pending, 0);
      const top = [...data.accountApprovals].sort((a, b) => b.pending - a.pending)[0];
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          message={
            total > 0 ? (
              <>{total} accounts pending{top ? `, most in ${top.band} (${top.pending})` : ""}.</>
            ) : undefined
          }
        >
          {data.accountApprovals.length ? (
            <AccountsPanel rows={data.accountApprovals} />
          ) : (
            <EmptyState />
          )}
        </PanelFrame>
      );
    }
    default:
      return null;
  }
}
