"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Pill } from "@/components/ui/pill";
import type { TeacherReportsPayload } from "@/services/teacher/reports.types";
import { REFERRAL_STATUS_LABELS } from "./reports-format";
import styles from "./reports.module.css";

/* Amber palette — one shade per case-activity slice. */
const SHADES = ["#d97706", "#f59e0b", "#fbbf24"];

interface Slice {
  key: string;
  label: string;
  value: number;
  percent: number;
  fill: string;
}

interface TooltipPayload {
  active?: boolean;
  payload?: { payload?: Slice }[];
}

function ActivityTooltip({ active, payload }: TooltipPayload) {
  const slice = payload?.[0]?.payload;
  if (!active || !slice) return null;
  return (
    <div className="grid gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 font-sans text-xs shadow-xl">
      <div className="flex items-center gap-1.5 font-medium">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-[2px]"
          style={{ background: slice.fill }}
        />
        {slice.label}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Records</span>
        <span className="font-sans font-medium tabular-nums text-foreground">
          {slice.value.toLocaleString()} ({slice.percent}%)
        </span>
      </div>
    </div>
  );
}

export function ReportsActivity({
  activity,
  summary,
}: {
  activity: TeacherReportsPayload["activity"];
  summary: TeacherReportsPayload["summary"];
}) {
  const items = [
    {
      key: "anecdotal",
      label: "Anecdotal records",
      value: activity.anecdotal,
    },
    {
      key: "referrals",
      label: "Referrals",
      value: activity.referrals.total,
    },
    {
      key: "finals",
      label: "Final grades recorded",
      value: summary.passing + summary.failing,
    },
  ];
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const slices: Slice[] = items.map((item, i) => ({
    ...item,
    percent: total > 0 ? Math.round((item.value / total) * 100) : 0,
    fill: SHADES[i] ?? SHADES[SHADES.length - 1],
  }));

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className="min-w-0">
          <h2 className={styles.cardTitle}>Case activity</h2>
          <p className={styles.cardSub}>Records and referrals you filed this term.</p>
        </div>
      </div>

      <div className={styles.activityBody}>
        <div className={styles.donutWrap}>
          <ResponsiveContainer width="100%" height={176}>
            <PieChart>
              <Pie
                data={
                  total > 0
                    ? slices
                    : [{ key: "empty", label: "No activity", value: 1, percent: 0, fill: "var(--muted)" }]
                }
                dataKey="value"
                nameKey="label"
                innerRadius="62%"
                outerRadius="92%"
                paddingAngle={total > 0 ? 2 : 0}
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive
                animationDuration={700}
              >
                {(total > 0
                  ? slices
                  : [{ key: "empty", fill: "var(--muted)" }]
                ).map((slice) => (
                  <Cell key={slice.key} fill={slice.fill} />
                ))}
              </Pie>
              <Tooltip
                cursor={false}
                content={<ActivityTooltip />}
                wrapperStyle={{ outline: "none", zIndex: 80 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className={styles.donutCenter} aria-hidden="true">
            <span className={styles.donutValue}>{total}</span>
            <span className={styles.donutLabel}>case records</span>
          </div>
        </div>

        <ul className={styles.activityLegend}>
          {slices.map((slice) => (
            <li key={slice.key} className={styles.activityLegendItem}>
              <span className={styles.legendSwatch} style={{ background: slice.fill }} aria-hidden />
              <span className={styles.legendLabel}>{slice.label}</span>
              <Pill tone={slice.value > 0 ? "amber" : "neutral"} label={slice.label}>
                {slice.value} · {slice.percent}%
              </Pill>
            </li>
          ))}
        </ul>

        {activity.referrals.byStatus.length > 0 ? (
          <div className={styles.chips}>
            {activity.referrals.byStatus.map((item) => (
              <Pill
                key={item.status}
                tone={item.count > 0 ? "amber" : "neutral"}
                label="Referral status"
              >
                {REFERRAL_STATUS_LABELS[item.status] ?? item.status}: {item.count}
              </Pill>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
