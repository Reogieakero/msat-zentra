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
import { CalendarClock, Hourglass } from "lucide-react";
import { NurseEmptyState } from "../../components/NurseEmptyCard";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./nurse-overview.module.css";

function useNowMs(intervalMs = 30_000): number {
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return nowMs;
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
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="clinic"
            name="Clinic matters"
            stroke="color-mix(in oklch, var(--primary), transparent 45%)"
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
              stroke="var(--primary)"
              strokeWidth={2}
              dot={{ fill: "var(--primary)", r: 3 }}
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
  const caseEmpty = dailyTrend.reduce((n, d) => n + d.adm + d.clinic, 0) === 0;
  const waitEmpty =
    needsReview.filter((r) =>
      Number.isFinite(Math.max(0, Date.now() - new Date(r.referredAt).getTime())),
    ).length === 0;
  return (
    <div className={styles.twoCol}>
      <div className={assign.card}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        {caseEmpty ? null : (
        <div className="relative">
          <h2 className={styles.sectionTitle}>Case load</h2>
          <p className={styles.sectionDesc}>
            Referred cases per day over the last 14 days — referred time to
            now.
          </p>
        </div>
        )}
        <div className="relative">
          {caseEmpty ? (
            <NurseEmptyState
              icon={CalendarClock}
              title="No referred cases"
              hint="No referred cases in the last 14 days."
            />
          ) : (
            <CaseLoadLine trend={dailyTrend} />
          )}
        </div>
      </div>
      <div className={assign.card}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        {waitEmpty ? null : (
        <div className="relative">
          <h2 className={styles.sectionTitle}>Waiting time</h2>
          <p className={styles.sectionDesc}>Time elapsed from referred to now.</p>
        </div>
        )}
        <div className="relative">
          {waitEmpty ? (
            <NurseEmptyState
              icon={Hourglass}
              title="No cases waiting"
              hint="Cases awaiting action will appear here."
            />
          ) : (
            <WaitingTimeLine rows={needsReview} />
          )}
        </div>
      </div>
    </div>
  );
}
