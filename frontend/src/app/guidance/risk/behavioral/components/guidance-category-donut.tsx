"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { GuidanceAnecdotalSummary } from "../../../anecdotal/components/guidance-anecdotal-data";
import styles from "./guidance-category-donut.module.css";

/** Neutral ink scale — darkest slice always marks the leading category. */
const SHADES = ["#171717", "#525252", "#737373", "#a3a3a3", "#d4d4d4"];

const CATEGORY_LABELS: { key: "behavioral" | "bullying" | "academic" | "attendance" | "health"; label: string }[] = [
  { key: "behavioral", label: "Behavioral" },
  { key: "bullying", label: "Bullying" },
  { key: "academic", label: "Academic" },
  { key: "attendance", label: "Attendance" },
  { key: "health", label: "Health" },
];

const TAKEAWAYS: Record<string, string> = {
  behavioral: "Conduct concerns dominate the queue — prioritize classroom behavior plans with the advisers.",
  bullying: "Bullying leads the queue — treat these as priority cases for immediate follow-up.",
  academic: "Learning concerns dominate — coordinate with subject teachers on remediation.",
  attendance: "Absence-driven referrals dominate — cross-check the attendance heatmap before counseling.",
  health: "Health-related referrals lead — coordinate with the school nurse on these cases.",
};

interface Slice {
  key: string;
  label: string;
  count: number;
  percent: number;
  fill: string;
}

export function buildCategorySlices(summary: GuidanceAnecdotalSummary): {
  slices: Slice[];
  total: number;
} {
  const total = summary.total;
  const ranked = CATEGORY_LABELS.map(({ key, label }) => ({
    key,
    label,
    count: summary[key],
  })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const slices = ranked.map((r, i) => ({
    ...r,
    percent: total > 0 ? Math.round((r.count / total) * 100) : 0,
    fill: SHADES[i] ?? SHADES[SHADES.length - 1],
  }));
  return { slices, total };
}

export function categoryInterpretation(summary: GuidanceAnecdotalSummary): string {
  const { slices, total } = buildCategorySlices(summary);
  if (total === 0) {
    return "No referred filings yet — the chart fills in as advisers route cases to guidance.";
  }
  const top = slices[0];
  const represented = slices.filter((s) => s.count > 0).length;
  const coverage =
    represented === 1
      ? "All filings sit in a single category."
      : `Filings span ${represented} of 5 categories.`;
  return `${top.label} leads with ${top.count} of ${total} referred filing${total === 1 ? "" : "s"} (${top.percent}%). ${TAKEAWAYS[top.key] ?? ""} ${coverage}`;
}

/**
 * Donut of referred filings by category + a plain-language read of what the
 * mix means. Counts only — the write-ups stay in the case files.
 */
export function GuidanceCategoryDonut({ summary }: { summary: GuidanceAnecdotalSummary }) {
  const { slices, total } = buildCategorySlices(summary);

  return (
    <div>
      <div className={styles.chartRow}>
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height={168}>
            <PieChart>
              <Pie
                data={total > 0 ? slices : [{ key: "empty", label: "Empty", count: 1, percent: 0, fill: "var(--hm-0)" }]}
                dataKey="count"
                nameKey="label"
                innerRadius="64%"
                outerRadius="100%"
                paddingAngle={total > 0 ? 2 : 0}
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive
                animationDuration={700}
              >
                {(total > 0 ? slices : [{ key: "empty", fill: "var(--hm-0)" }]).map((d) => (
                  <Cell key={d.key} fill={d.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className={styles.center} aria-hidden="true">
            <span className={styles.centerValue}>{total}</span>
            <span className={styles.centerLabel}>
              referred filing{total === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <ul className={styles.legend}>
          {slices.map((s) => (
            <li key={s.key} className={styles.legendItem}>
              <span className={styles.swatch} style={{ background: s.fill }} aria-hidden="true" />
              <span className={styles.legendLabel}>{s.label}</span>
              <span className={styles.legendValue}>
                {s.count} · {s.percent}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className={styles.interpretation} role="status">
        {categoryInterpretation(summary)}
      </p>
    </div>
  );
}
