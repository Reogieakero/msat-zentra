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
import { Card } from "@/components/ui/card";
import type { NurseQueueRow, NurseTrendPoint } from "./nurse-overview-data";
import styles from "./nurse-overview.module.css";

/* Minute-precision clock is enough (no seconds displayed) — re-renders
   twice a minute so the waiting card stays fresh. */
function useNowMs(intervalMs = 30_000): number {
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return nowMs;
}

/* Daily case-load line over the trailing 14 days — referred time to now,
   one line per case type. */
function CaseLoadLine({ trend }: { trend: NurseTrendPoint[] }) {
  const total = trend.reduce((n, d) => n + d.adm + d.clinic, 0);
  if (total === 0) {
    return <p className={styles.empty}>No referred cases in the last 14 days.</p>;
  }
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
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--foreground)",
              fontSize: "0.75rem",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
          <Line
            type="monotone"
            dataKey="adm"
            name="ADM cases"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="clinic"
            name="Clinic matters"
            stroke="var(--chart-4)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* "2d 4h 12m" / "4h 12m" / "12m" / "Just now" — days, hours, minutes
   only, never seconds; same vocabulary as the queue's Waiting column. */
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

/* Waiting time per case — one point per waiting case, longest waiting
   first, in hours. A line fits waiting time better than bars: it reads
   as the queue draining from the longest wait down. */
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

  if (points.length === 0) {
    return <p className={styles.empty}>No cases waiting.</p>;
  }

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
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "var(--foreground)",
                fontSize: "0.75rem",
              }}
              formatter={(_value, _name, item) => [
                item?.payload?.label ?? _value,
                "Waiting",
              ]}
            />
            <Line
              type="monotone"
              dataKey="hours"
              name="Waiting time"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ fill: "var(--chart-1)", r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
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
  return (
    <div className={styles.twoCol}>
      <Card className={styles.panel}>
        <h2 className={styles.panelTitle}>Case load</h2>
        <p className={styles.panelDesc}>
          Referred cases per day over the last 14 days — referred time to now.
        </p>
        <CaseLoadLine trend={dailyTrend} />
      </Card>
      <Card className={styles.panel}>
        <h2 className={styles.panelTitle}>Waiting time</h2>
        <p className={styles.panelDesc}>Time elapsed from referred to now.</p>
        <WaitingTimeLine rows={needsReview} />
      </Card>
    </div>
  );
}
