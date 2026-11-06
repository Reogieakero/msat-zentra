"use client";

import * as React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NurseQueueRow, NurseTrendPoint } from "@/services/nurse/nurse.types";
import type { LucideIcon } from "lucide-react";
import { CalendarClock, Hourglass } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { InsightCallout } from "@/components/ui/insight-callout";
import { NurseEmptyState } from "../../components/NurseEmptyCard";
import { NurseChartTooltip, NURSE_TOOLTIP_Z_INDEX } from "./nurse-chart-tooltip";
import { formatDate } from "@/lib/labels/datetime";
import styles from "./nurse-overview.module.css";

// Amber — the rail's accent (tailwind amber-500), same palette as the
// breakdown charts.
const AMBER = "oklch(0.769 0.188 70.08)";

/** Uniform "What it means" footer — the shared insight callout, pinned low. */
function Interpretation({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.footerSlot}>
      <InsightCallout className={styles.interpretation}>
        <span className={styles.interpretationLabel}>What it means · </span>
        {children}
      </InsightCallout>
    </div>
  );
}

function useNowMs(intervalMs = 30_000): number {
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return nowMs;
}

/** Board header icon — same slot as the case board / breakdown boards. */
function BoardIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="text-primary" aria-hidden>
      <Icon size={14} />
    </span>
  );
}

function CaseLoadLine({ trend }: { trend: NurseTrendPoint[] }) {
  return (
    <div
      className={styles.lineChart}
      role="img"
      aria-label={`Case load, last 14 days: ${trend.map((d) => `${d.date} ADM ${d.adm}, Clinic ${d.clinic}`).join("; ")}`}
    >
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            minTickGap={24}
            tickFormatter={(v) => {
              if (!v || typeof v !== "string") return "";
              const parts = v.split("-");
              return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : v;
            }}
          />
          <YAxis
            type="number"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            allowDecimals={false}
          />
          <Tooltip
            content={<NurseChartTooltip />}
            wrapperStyle={NURSE_TOOLTIP_Z_INDEX}
          />
          <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
          <Line
            type="monotone"
            dataKey="adm"
            name="ADM cases"
            stroke={AMBER}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="clinic"
            name="Clinic matters"
            stroke={`color-mix(in oklch, ${AMBER}, transparent 45%)`}
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatElapsedLong(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  if (totalMinutes < 1) return "Just now";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

function WaitingTimeLine({ rows }: { rows: NurseQueueRow[] }) {
  const nowMs = useNowMs();

  const { points, averageMs, waited } = React.useMemo(() => {
    const elapsedList = rows
      .map((row) => ({
        row,
        elapsed: Math.max(0, nowMs - new Date(row.referredAt).getTime()),
      }))
      .filter((r) => Number.isFinite(r.elapsed))
      .sort((a, b) => b.elapsed - a.elapsed);
    const points = elapsedList.map(({ row, elapsed }) => ({
      student: row.student,
      hours: Math.round((elapsed / 3_600_000) * 10) / 10,
      label: formatElapsedLong(elapsed),
    }));
    const total = elapsedList.reduce((n, r) => n + r.elapsed, 0);
    return {
      points,
      averageMs: points.length > 0 ? total / points.length : 0,
      waited: points.length,
    };
  }, [rows, nowMs]);

  const overDay = points.filter((p) => p.hours >= 24).length;
  const oldest = points[0]?.label ?? "—";

  return (
    <>
      <p className={styles.legendTotal}>
        Average {formatElapsedLong(averageMs)} across {waited}{" "}
        {waited === 1 ? "waiting case" : "waiting cases"}
      </p>
      <div
        className={styles.lineChart}
        role="img"
        aria-label={`Waiting time, longest first: ${points.map((p) => `${p.student} ${p.label}`).join(", ")}`}
      >
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="student" tickLine={false} axisLine={false} tick={false} />
            <YAxis
              type="number"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              tickFormatter={(v) => (typeof v === "number" ? `${v}h` : v)}
            />
            <Tooltip
              content={
                <NurseChartTooltip
                  formatValue={(item) => item.payload?.label ?? item.value}
                />
              }
              wrapperStyle={NURSE_TOOLTIP_Z_INDEX}
            />
            <Line
              type="monotone"
              dataKey="hours"
              name="Waiting time"
              stroke={AMBER}
              strokeWidth={2}
              dot={{ fill: AMBER, r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Interpretation>
        {overDay === 0
          ? `No case has passed 24 hours yet — oldest is at ${oldest}.`
          : `${overDay} of ${waited} waiting ${
              waited === 1 ? "case has" : "cases have"
            } passed 24 hours — oldest is at ${oldest}.`}
      </Interpretation>
    </>
  );
}

export function NurseOverviewTrends({
  dailyTrend,
  needsReview,
}: {
  dailyTrend: NurseTrendPoint[];
  needsReview: NurseQueueRow[];
}) {
  const caseTotal = dailyTrend.reduce((n, d) => n + d.adm + d.clinic, 0);
  const caseEmpty = caseTotal === 0;
  const busiest = React.useMemo(() => {
    let best: { date: string; count: number } | null = null;
    for (const d of dailyTrend) {
      const count = d.adm + d.clinic;
      if (count <= 0) continue;
      if (!best || count > best.count) best = { date: d.date, count };
    }
    return best;
  }, [dailyTrend]);
  // Cases with a parseable referred time — matches WaitingTimeLine's filter.
  const waited = needsReview.filter((r) =>
    Number.isFinite(new Date(r.referredAt).getTime()),
  ).length;
  const waitEmpty = waited === 0;

  return (
    <div className={styles.twoCol}>
      <KanbanBoard
        title="Case load"
        icon={<BoardIcon icon={CalendarClock} />}
        count={caseTotal}
        description="Referred cases per day over the last 14 days — referred time to now."
        className="flex-1"
      >
        {caseEmpty ? (
          <NurseEmptyState
            icon={CalendarClock}
            title="No referred cases"
            hint="No referred cases in the last 14 days."
          />
        ) : (
          <CaseLoadLine trend={dailyTrend} />
        )}
        <Interpretation>
          {caseEmpty
            ? "No referrals landed in the last 14 days."
            : busiest
              ? `${caseTotal} referral${
                  caseTotal === 1 ? "" : "s"
                } in the last 14 days — busiest on ${formatDate(
                  busiest.date,
                )} with ${busiest.count}.`
              : `${caseTotal} referral${
                  caseTotal === 1 ? "" : "s"
                } in the last 14 days.`}
        </Interpretation>
      </KanbanBoard>

      <KanbanBoard
        title="Waiting time"
        icon={<BoardIcon icon={Hourglass} />}
        count={waited}
        description="Time elapsed from referred to now."
        className="flex-1"
      >
        {waitEmpty ? (
          <>
            <NurseEmptyState
              icon={Hourglass}
              title="No cases waiting"
              hint="Cases awaiting action will appear here."
            />
            <Interpretation>
              No cases are waiting — every referral has been actioned.
            </Interpretation>
          </>
        ) : (
          <WaitingTimeLine rows={needsReview} />
        )}
      </KanbanBoard>
    </div>
  );
}
