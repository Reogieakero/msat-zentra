"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AdminLoginActivityEvent } from "@/services/admin/admin.service";
import { roleLabel } from "@/lib/auth/roles";
import { Pill } from "@/components/ui/pill";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { roleColor } from "./role-colors";
import styles from "./login-activity-chart.module.css";

/* Amber ramp — same shade steps as the teacher/guidance/nurse overview charts
   so every role's boards read as one system. */
const AMBER = "oklch(0.769 0.188 70.08)";
const SIGN_OUT = `color-mix(in oklch, ${AMBER}, transparent 45%)`;
const TOOLTIP_Z_INDEX = { zIndex: 50 };

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fullTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Same swatch colours as the role legend, tinted into the shared pill. */
function rolePillStyle(role: string): React.CSSProperties {
  const color = roleColor(role);
  return {
    color,
    backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)`,
  };
}

/** Same popover tooltip the teacher/guidance/nurse overview charts use. */
function ActivityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{
    name?: string | number;
    value?: number | string;
    color?: string;
    dataKey?: string | number;
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const items = payload.filter((item) => item.value !== undefined && item.value !== null);
  if (items.length === 0) return null;

  return (
    <div className={styles.chartTooltip} role="tooltip">
      {label !== undefined && label !== null && label !== "" ? (
        <p className={styles.chartTooltipLabel}>{label}</p>
      ) : null}
      <ul className={styles.chartTooltipList}>
        {items.map((item, index) => {
          const isLogin = item.dataKey === "Logins";
          return (
            <li key={`${String(item.dataKey ?? item.name)}-${index}`}>
              <Pill
                tone={isLogin ? "amber" : "neutral"}
                label={
                  isLogin
                    ? "Total sign-ins up to this moment"
                    : "Total sign-outs up to this moment"
                }
              >
                {item.name}
                <span className={styles.chartTooltipValue}>{item.value}</span>
              </Pill>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function LoginActivityChart({
  events,
  total,
  signOuts,
  windowHours,
}: {
  events: AdminLoginActivityEvent[];
  total: number;
  signOuts: number;
  windowHours: number;
}) {
  // One point per event timestamp, plotted as running totals so the line keeps
  // rising through the window (no hourly buckets).
  const points = React.useMemo(() => {
    const rows: Array<{
      at: string;
      label: string;
      axisLabel: string;
      Logins: number;
      "Sign-outs": number;
    }> = [];
    let logins = 0;
    let outs = 0;
    for (const event of events) {
      if (event.kind === "logout") outs += 1;
      else logins += 1;
      rows.push({
        at: event.at,
        label: fullTimeLabel(event.at),
        axisLabel: timeLabel(event.at),
        Logins: logins,
        "Sign-outs": outs,
      });
    }
    return rows;
  }, [events]);

  return (
    <div className={styles.chart}>
      <div className={styles.head}>
        <span className={styles.title}>Logins &amp; sign-outs</span>
        <span className={styles.meta}>
          <Pill tone="amber" label="Sign-ins in the last 24 hours">
            {total} in
          </Pill>
          <Pill tone="neutral" label="Sign-outs in the last 24 hours">
            {signOuts} out
          </Pill>
          <Pill tone="neutral" label="Chart time window">
            last {windowHours}h
          </Pill>
        </span>
      </div>

      <div className={styles.plot}>
        {points.length > 0 ? (
          <div
            className={styles.lineChart}
            role="img"
            aria-label={`Logins and sign-outs over the last ${windowHours} hours: ${total} sign-ins, ${signOuts} sign-outs`}
          >
            <ResponsiveContainer width="100%" height={168}>
              <AreaChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="admin-logins-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AMBER} stopOpacity={0.36} />
                    <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="admin-signouts-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AMBER} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="axisLabel"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tick={{ fontSize: 9 }}
                  height={18}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  fontSize={9}
                  width={30}
                />
                <Tooltip
                  content={<ActivityTooltip />}
                  wrapperStyle={TOOLTIP_Z_INDEX}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.label ?? ""
                  }
                />
                <Area
                  type="monotone"
                  dataKey="Sign-outs"
                  stroke={SIGN_OUT}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  fill="url(#admin-signouts-fill)"
                  fillOpacity={1}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="Logins"
                  stroke={AMBER}
                  strokeWidth={2}
                  fill="url(#admin-logins-fill)"
                  fillOpacity={1}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className={styles.empty}>No sign-ins yet</p>
        )}
      </div>

      {points.length > 0 ? (
        <ul className={styles.legend}>
          <li className={styles.legendItem}>
            <span className={styles.swatch} style={{ background: AMBER }} aria-hidden="true" />
            <span className={styles.legendLabel}>Logins</span>
            <span className={styles.legendValue}>{total}</span>
          </li>
          <li className={styles.legendItem}>
            <span
              className={styles.swatch}
              style={{ background: SIGN_OUT }}
              aria-hidden="true"
            />
            <span className={styles.legendLabel}>Sign-outs</span>
            <span className={styles.legendValue}>{signOuts}</span>
          </li>
        </ul>
      ) : null}

      <LatestAccess events={events} />
    </div>
  );
}

/** Five most recent sign-ins or sign-outs, switched with the shared pill tabs. */
function LatestAccess({ events }: { events: AdminLoginActivityEvent[] }) {
  const [tab, setTab] = React.useState<"login" | "logout">("login");
  const rows = React.useMemo(
    () =>
      events
        .filter((event) => event.kind === tab)
        .slice(-5)
        .reverse(),
    [events, tab],
  );

  return (
    <div className={styles.latest}>
      <div className={styles.filterTabs} role="tablist" aria-label="Latest activity">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "login"}
          onClick={() => setTab("login")}
          className={styles.filterTab}
        >
          <Pill tone={tab === "login" ? "amber" : "neutral"} className="h-6 px-2.5">
            Latest logins
          </Pill>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "logout"}
          onClick={() => setTab("logout")}
          className={styles.filterTab}
        >
          <Pill tone={tab === "logout" ? "amber" : "neutral"} className="h-6 px-2.5">
            Latest sign-outs
          </Pill>
        </button>
      </div>

      {rows.length === 0 ? (
        <p className={styles.latestEmpty}>
          {tab === "login" ? "No sign-ins in this window." : "No sign-outs in this window."}
        </p>
      ) : (
        <ul className={styles.latestList}>
          {rows.map((event, index) => (
            <li key={`${event.id}-${event.at}-${index}`} className={styles.latestRow}>
              <span className={styles.latestAvatar} aria-hidden="true">
                <StudentMascot
                  name={event.fullName}
                  seed={event.id}
                  character={event.mascot ?? undefined}
                  size={22}
                />
              </span>
              <span className={styles.latestName}>{event.fullName}</span>
              <Pill
                tone="neutral"
                label="Role"
                className={styles.latestRolePill}
                style={rolePillStyle(event.role)}
              >
                {roleLabel(event.role)}
              </Pill>
              <span className={styles.latestTime}>{timeLabel(event.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

