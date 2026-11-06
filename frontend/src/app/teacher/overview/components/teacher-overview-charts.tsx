"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
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
  Activity,
  ClipboardCheck,
  Flag,
  GraduationCap,
  HeartPulse,
  TrendingUp,
} from "lucide-react";
import { KanbanBoard, KanbanBoardEmpty } from "@/components/ui/kanban-board";
import { InsightCallout } from "@/components/ui/insight-callout";
import { Pill } from "@/components/ui/pill";
import { useTeacherOverviewGradebook, useTeacherOverviewInsights } from "@/services/teacher/overview.service";
import type { TeacherOverviewCritical } from "@/services/teacher/overview.types";
import styles from "./teacher-overview-charts.module.css";

/* Amber ramp — the teacher shell accent. Same shade steps as the guidance and
   nurse overview charts so every role's boards read as one system. */
const AMBER = "oklch(0.769 0.188 70.08)";
const SHADES = [
  AMBER,
  `color-mix(in oklch, ${AMBER}, transparent 12%)`,
  `color-mix(in oklch, ${AMBER}, transparent 26%)`,
  `color-mix(in oklch, ${AMBER}, transparent 40%)`,
  `color-mix(in oklch, ${AMBER}, transparent 54%)`,
  `color-mix(in oklch, ${AMBER}, transparent 66%)`,
  `color-mix(in oklch, ${AMBER}, transparent 76%)`,
];

const TOOLTIP_Z_INDEX = { zIndex: 50 };

/** Board header icon — same slot as the guidance/nurse overview boards. */
function BoardIcon({ icon: Icon }: { icon: React.ComponentType<{ size?: number }> }) {
  return (
    <span className={styles.boardIcon} aria-hidden>
      <Icon size={14} />
    </span>
  );
}

/** Board header count — amber figures, readable in both themes. */
function amberCount(value: number) {
  return <span className={styles.amberNumber}>{value}</span>;
}

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

/**
 * Custom tooltip shared by every chart on the page. Uses the popover surface
 * tokens so it reads correctly in both themes (white card in light mode, dark
 * card in dark mode) and shows the amber figures the boards use.
 */
function TeacherChartTooltip({
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
    payload?: { fill?: string };
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
          const fill =
            (item.payload as { fill?: string } | undefined)?.fill ??
            item.color ??
            "var(--muted-foreground)";
          return (
            <li
              key={`${String(item.dataKey ?? item.name)}-${index}`}
              className={styles.chartTooltipRow}
            >
              <span
                className={styles.chartTooltipDot}
                style={{ background: fill }}
                aria-hidden="true"
              />
              <span className={styles.chartTooltipName}>{item.name}</span>
              <span className={styles.chartTooltipValue}>{item.value}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Chromeless legend row with the rectangle count/share pill. */
function LegendRow({
  color,
  label,
  value,
  hint,
}: {
  color: string;
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <li className={styles.legendItem}>
      <span className={styles.swatch} style={{ background: color }} aria-hidden="true" />
      <span className={styles.legendLabel}>{label}</span>
      <span className={styles.legendValue}>
        <Pill label={hint}>{value}</Pill>
      </span>
    </li>
  );
}

interface TeacherOverviewChartsProps {
  overview: TeacherOverviewCritical;
  /** At-risk factor counts already resolved by the page (adviser vs class). */
  factors: { academic: number; attendance: number; behavioral: number };
  hideBehavioral?: boolean;
  /** Day window for the trend charts. */
  days?: number;
}

export function TeacherOverviewCharts({
  overview,
  factors,
  hideBehavioral = false,
  days = 14,
}: TeacherOverviewChartsProps) {
  const { data: insights, isPending: insightsPending } = useTeacherOverviewInsights(days);
  const { data: gradebook, isPending: gradebookPending } = useTeacherOverviewGradebook();

  const riskMix = insights?.riskMix ?? null;
  const mix = React.useMemo(() => {
    if (!riskMix) return [];
    const rows: { key: string; label: string; value: number }[] = [
      { key: "high", label: "High", value: riskMix.high },
      { key: "moderate", label: "Moderate", value: riskMix.moderate },
      { key: "low", label: "Low", value: riskMix.low },
    ];
    if (riskMix.unassessed > 0) {
      rows.push({ key: "unassessed", label: "Unassessed", value: riskMix.unassessed });
    }
    return rows
      .filter((r) => r.value > 0)
      .map((r, i) => ({ ...r, fill: SHADES[i] ?? SHADES[SHADES.length - 1] }));
  }, [riskMix]);
  const mixTotal = mix.reduce((sum, r) => sum + r.value, 0);
  const flagged = mix
    .filter((r) => r.key === "high" || r.key === "moderate")
    .reduce((sum, r) => sum + r.value, 0);

  const factorRows = React.useMemo(
    () =>
      [
        { key: "academic", label: "Academic", value: factors.academic },
        { key: "attendance", label: "Attendance", value: factors.attendance },
        ...(hideBehavioral
          ? []
          : [{ key: "behavioral", label: "Behavioral", value: factors.behavioral }]),
      ].map((r, i) => ({ ...r, fill: SHADES[i] ?? SHADES[SHADES.length - 1] })),
    [factors, hideBehavioral],
  );
  const factorTotal = factorRows.reduce((sum, r) => sum + r.value, 0);

  const trendPoints = React.useMemo(
    () =>
      (insights?.series ?? []).map((d) => ({
        label: d.label,
        High: d.high,
        Moderate: d.moderate,
        Low: d.low,
      })),
    [insights],
  );
  const trendTotals = trendPoints.reduce(
    (acc, p) => ({ High: acc.High + p.High, Moderate: acc.Moderate + p.Moderate }),
    { High: 0, Moderate: 0 },
  );

  const attendancePoints = React.useMemo(
    () =>
      (insights?.series ?? []).map((d) => ({
        label: d.label,
        Present: d.present,
        Late: d.late,
        Absent: d.absent,
        Excused: d.excused,
        rate: d.rate ?? 0,
      })),
    [insights],
  );
  const avgRate = attendancePoints.length
    ? Math.round(attendancePoints.reduce((sum, p) => sum + p.rate, 0) / attendancePoints.length)
    : 0;
  const attendanceTotals = attendancePoints.reduce(
    (acc, p) => ({
      absent: acc.absent + p.Absent,
      late: acc.late + p.Late,
      excused: acc.excused + p.Excused,
    }),
    { absent: 0, late: 0, excused: 0 },
  );

  const subjectRows = React.useMemo(() => {
    const standings = gradebook?.standings ?? [];
    const subjectCounts = new Map<string, number>();
    for (const row of standings) {
      subjectCounts.set(row.subject, (subjectCounts.get(row.subject) ?? 0) + 1);
    }
    return standings
      .map((row) => ({
        key: `${row.subject}-${row.section}`,
        label:
          (subjectCounts.get(row.subject) ?? 0) > 1
            ? `${row.subject} · ${row.section}`
            : row.subject,
        average: Math.round(row.average * 10) / 10,
      }))
      .sort((a, b) => b.average - a.average)
      .slice(0, 8)
      .map((row, i) => ({ ...row, fill: SHADES[Math.min(i, SHADES.length - 1)] }));
  }, [gradebook]);
  const belowTarget = subjectRows.filter((r) => r.average < 75).length;
  const classAverage = subjectRows.length
    ? Math.round(
        (subjectRows.reduce((sum, r) => sum + r.average, 0) / subjectRows.length) * 10,
      ) / 10
    : 0;

  const pipelineRows = React.useMemo(() => {
    const map = new Map<
      string,
      { label: string; draft: number; published: number; locked: number }
    >();
    for (const a of gradebook?.assessments ?? []) {
      const row =
        map.get(a.subject) ?? { label: a.subject, draft: 0, published: 0, locked: 0 };
      if (a.status === "scores_locked") row.locked += 1;
      else if (a.status === "published") row.published += 1;
      else row.draft += 1;
      map.set(a.subject, row);
    }
    return [...map.values()].slice(0, 8);
  }, [gradebook]);
  const pipelineTotal = pipelineRows.reduce(
    (sum, r) => sum + r.draft + r.published + r.locked,
    0,
  );

  const populationLabel =
    insights?.populationLabel ?? (overview.isAdviser ? "advisees" : "students");

  return (
    <div className={styles.stack}>
      <div className={styles.grid}>
        {/* Risk mix donut ------------------------------------------------ */}
        <KanbanBoard
          title="Risk mix"
          icon={<BoardIcon icon={HeartPulse} />}
          count={amberCount(mixTotal)}
          description={`Current risk level of your ${populationLabel}.`}
          className="flex-1"
        >
          {insightsPending ? (
            <KanbanBoardEmpty>Loading risk mix…</KanbanBoardEmpty>
          ) : mix.length === 0 ? (
            <KanbanBoardEmpty>No risk snapshots yet.</KanbanBoardEmpty>
          ) : (
            <div className={styles.chartBody}>
              <div
                className={styles.chartRow}
                role="img"
                aria-label={`Risk mix: ${mix.map((r) => `${r.label} ${r.value}`).join(", ")}`}
              >
                <div className={styles.chartWrap}>
                  <ResponsiveContainer width="100%" height={132}>
                    <PieChart>
                      <Pie
                        data={mix}
                        dataKey="value"
                        nameKey="label"
                        innerRadius="64%"
                        outerRadius="100%"
                        paddingAngle={2}
                        stroke="transparent"
                        isAnimationActive
                        animationDuration={700}
                      >
                        {mix.map((r) => (
                          <Cell key={r.key} fill={r.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<TeacherChartTooltip />} wrapperStyle={TOOLTIP_Z_INDEX} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className={styles.center} aria-hidden="true">
                    <span className={styles.centerValue}>{mixTotal}</span>
                    <span className={styles.centerLabel}>
                      {mixTotal === 1 ? "student" : "students"}
                    </span>
                  </div>
                </div>
                <ul className={styles.legend}>
                  {mix.map((r) => (
                    <LegendRow
                      key={r.key}
                      color={r.fill}
                      label={r.label}
                      value={
                        <>
                          <span className={styles.legendPillCount}>{r.value}</span>
                          <span className={styles.legendPillPercent}>
                            {mixTotal > 0 ? Math.round((r.value / mixTotal) * 100) : 0}%
                          </span>
                        </>
                      }
                      hint={`${r.label} risk and share of your ${populationLabel}`}
                    />
                  ))}
                </ul>
              </div>
            </div>
          )}
          <Interpretation>
            {mixTotal === 0
              ? "No risk snapshots yet — the hourly sweep fills this once grades and attendance land."
              : `${flagged} of ${mixTotal} ${populationLabel} are flagged high or moderate.`}
          </Interpretation>
        </KanbanBoard>

        {/* Risk factors -------------------------------------------------- */}
        <KanbanBoard
          title="Students by risk factor"
          icon={<BoardIcon icon={Flag} />}
          count={amberCount(factorTotal)}
          description="Which signals are flagging learners right now."
          className="flex-1"
        >
          {factorTotal === 0 ? (
            <KanbanBoardEmpty>No active risk factors.</KanbanBoardEmpty>
          ) : (
            <div
              className={`${styles.barChart} ${styles.chartBody}`}
              role="img"
              aria-label={`Risk factors: ${factorRows.map((r) => `${r.label} ${r.value}`).join(", ")}`}
            >
              <ResponsiveContainer width="100%" height={Math.max(120, factorRows.length * 28 + 8)}>
                <BarChart
                  data={factorRows}
                  layout="vertical"
                  margin={{ top: 2, right: 28, bottom: 2, left: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="label" width={92} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={false}
                    content={<TeacherChartTooltip />}
                    wrapperStyle={TOOLTIP_Z_INDEX}
                  />
                  <Bar dataKey="value" name="Students" barSize={12} radius={[2, 4, 4, 2]}>
                    {factorRows.map((r) => (
                      <Cell key={r.key} fill={r.fill} />
                    ))}
                    <LabelList dataKey="value" position="right" className={styles.barNumber} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <Interpretation>
            {factorTotal === 0
              ? "No risk flags tripped — every learner clears all checks."
              : "One learner can trip several flags, so the counts overlap."}
          </Interpretation>
        </KanbanBoard>

        {/* Subject averages ---------------------------------------------- */}
        <KanbanBoard
          title="Subject averages"
          icon={<BoardIcon icon={GraduationCap} />}
          count={amberCount(subjectRows.length)}
          description="Each slice is one class, sized by its term average."
          className="flex-1"
        >
          {gradebookPending ? (
            <KanbanBoardEmpty>Loading averages…</KanbanBoardEmpty>
          ) : subjectRows.length === 0 ? (
            <KanbanBoardEmpty>No graded classes yet.</KanbanBoardEmpty>
          ) : (
            <div className={styles.chartBody}>
              <div
                className={styles.donut}
                role="img"
                aria-label={`Subject averages: ${subjectRows.map((r) => `${r.label} ${r.average}`).join(", ")}`}
              >
                <ResponsiveContainer width="100%" height={168}>
                  <PieChart>
                    <Pie
                      data={subjectRows}
                      dataKey="average"
                      nameKey="label"
                      innerRadius="64%"
                      outerRadius="100%"
                      paddingAngle={2}
                      stroke="transparent"
                      isAnimationActive
                      animationDuration={700}
                    >
                      {subjectRows.map((r) => (
                        <Cell key={r.key} fill={r.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<TeacherChartTooltip />} wrapperStyle={TOOLTIP_Z_INDEX} />
                  </PieChart>
                </ResponsiveContainer>
                <div className={styles.center} aria-hidden="true">
                  <span className={styles.centerValue}>{classAverage}</span>
                  <span className={styles.centerLabel}>class avg</span>
                </div>
              </div>
            </div>
          )}
          <Interpretation>
            {subjectRows.length === 0
              ? "No graded classes yet this term."
              : belowTarget === 0
                ? "Every class is at or above the 75 target."
                : `${belowTarget} of ${subjectRows.length} classes sit below the 75 target.`}
          </Interpretation>
        </KanbanBoard>
      </div>

      <div className={styles.gridWide}>
        {/* Day-by-day detection ------------------------------------------ */}
        <KanbanBoard
          title="At-risk detection, day by day"
          icon={<BoardIcon icon={TrendingUp} />}
          count={amberCount(insights?.learnerCount ?? 0)}
          description={`${insights?.learnerCount ?? 0} ${
            (insights?.learnerCount ?? 0) === 1 ? "learner" : "learners"
          } · last ${insights?.series.length ?? 0} school days`}
          className="flex-1"
        >
          {insightsPending ? (
            <KanbanBoardEmpty>Loading detection trend…</KanbanBoardEmpty>
          ) : trendPoints.length === 0 ? (
            <KanbanBoardEmpty>No school days in range yet.</KanbanBoardEmpty>
          ) : (
            <div className={styles.chartBody}>
              <div
                className={styles.lineChart}
                role="img"
                aria-label={`At-risk trend: ${trendPoints
                  .map((p) => `${p.label} high ${p.High}, moderate ${p.Moderate}, low ${p.Low}`)
                  .join("; ")}`}
              >
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendPoints} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      fontSize={11}
                      width={34}
                    />
                    <Tooltip content={<TeacherChartTooltip />} wrapperStyle={TOOLTIP_Z_INDEX} />
                    <Line
                      type="monotone"
                      dataKey="High"
                      stroke={SHADES[0]}
                      strokeWidth={2}
                      dot={{ r: 3, fill: SHADES[0], strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Moderate"
                      stroke={`color-mix(in oklch, ${AMBER}, transparent 45%)`}
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Low"
                      stroke={SHADES[5]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <ul className={styles.legend}>
                <LegendRow
                  color={SHADES[0]}
                  label="High"
                  value={trendTotals.High}
                  hint="High-risk learner-days in the window"
                />
                <LegendRow
                  color={`color-mix(in oklch, ${AMBER}, transparent 45%)`}
                  label="Moderate"
                  value={trendTotals.Moderate}
                  hint="Moderate-risk learner-days in the window"
                />
              </ul>
            </div>
          )}
          <Interpretation>
            A rising high line means more learners are ticking two or more risk flags.
          </Interpretation>
        </KanbanBoard>

        {/* Attendance trend ---------------------------------------------- */}
        <KanbanBoard
          title="Attendance, day by day"
          icon={<BoardIcon icon={Activity} />}
          count={amberCount(avgRate)}
          description="Present rate with the late and absent counts behind it."
          className="flex-1"
        >
          {insightsPending ? (
            <KanbanBoardEmpty>Loading attendance trend…</KanbanBoardEmpty>
          ) : attendancePoints.length === 0 ? (
            <KanbanBoardEmpty>No school days in range yet.</KanbanBoardEmpty>
          ) : (
            <div className={styles.chartBody}>
              <div
                className={styles.lineChart}
                role="img"
                aria-label={`Attendance trend: ${attendancePoints
                  .map((p) => `${p.label} ${p.rate}% present, ${p.Absent} absent`)
                  .join("; ")}`}
              >
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={attendancePoints} margin={{ top: 8, right: 4, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      yAxisId="count"
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      width={34}
                    />
                    <YAxis
                      yAxisId="rate"
                      orientation="right"
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      width={38}
                      unit="%"
                    />
                    <Tooltip
                      content={<TeacherChartTooltip />}
                      cursor={{ fill: "var(--muted)" }}
                      wrapperStyle={TOOLTIP_Z_INDEX}
                    />
                    <Bar
                      yAxisId="count"
                      dataKey="Absent"
                      stackId="marks"
                      fill={SHADES[0]}
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar yAxisId="count" dataKey="Late" stackId="marks" fill={SHADES[2]} />
                    <Bar
                      yAxisId="count"
                      dataKey="Excused"
                      stackId="marks"
                      fill={SHADES[4]}
                      radius={[2, 2, 0, 0]}
                    />
                    <Line
                      yAxisId="rate"
                      type="monotone"
                      dataKey="rate"
                      name="Present %"
                      stroke={AMBER}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <ul className={styles.legend}>
                <LegendRow
                  color={SHADES[0]}
                  label="Absent"
                  value={attendanceTotals.absent}
                  hint="Absent marks in the window"
                />
                <LegendRow
                  color={SHADES[2]}
                  label="Late"
                  value={attendanceTotals.late}
                  hint="Late marks in the window"
                />
                <LegendRow
                  color={SHADES[4]}
                  label="Excused"
                  value={attendanceTotals.excused}
                  hint="Excused marks in the window"
                />
                <LegendRow color={AMBER} label="Present %" value={`${avgRate}%`} hint="Average present rate in the window" />
              </ul>
            </div>
          )}
          <Interpretation>
            Bars are counts of late, absent and excused marks; the line is the present rate.
          </Interpretation>
        </KanbanBoard>
      </div>

      {/* Assessment pipeline ---------------------------------------------- */}
      <KanbanBoard
        title="Assessment pipeline"
        icon={<BoardIcon icon={ClipboardCheck} />}
        count={amberCount(pipelineTotal)}
        description="Draft, published and locked assessments per subject."
        className="flex-1"
      >
        {gradebookPending ? (
          <KanbanBoardEmpty>Loading assessments…</KanbanBoardEmpty>
        ) : pipelineRows.length === 0 ? (
          <KanbanBoardEmpty>No assessments yet this term.</KanbanBoardEmpty>
        ) : (
          <div className={styles.chartBody}>
            <div
              className={styles.lineChart}
              role="img"
              aria-label={`Assessment pipeline: ${pipelineRows
                .map((r) => `${r.label} draft ${r.draft}, published ${r.published}, locked ${r.locked}`)
                .join("; ")}`}
            >
              <ResponsiveContainer width="100%" height={Math.max(140, pipelineRows.length * 26 + 12)}>
                <BarChart
                  data={pipelineRows}
                  layout="vertical"
                  margin={{ top: 2, right: 8, bottom: 2, left: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="label" width={116} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={false}
                    content={<TeacherChartTooltip />}
                    wrapperStyle={TOOLTIP_Z_INDEX}
                  />
                  <Bar dataKey="draft" name="Draft" stackId="status" barSize={12} fill={SHADES[5]} />
                  <Bar dataKey="published" name="Published" stackId="status" barSize={12} fill={SHADES[2]} />
                  <Bar
                    dataKey="locked"
                    name="Locked"
                    stackId="status"
                    barSize={12}
                    fill={SHADES[0]}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className={styles.legend}>
              <LegendRow
                color={SHADES[5]}
                label="Draft"
                value={pipelineRows.reduce((n, r) => n + r.draft, 0)}
                hint="Assessments still being set up"
              />
              <LegendRow
                color={SHADES[2]}
                label="Published"
                value={pipelineRows.reduce((n, r) => n + r.published, 0)}
                hint="Assessments open for scoring"
              />
              <LegendRow
                color={SHADES[0]}
                label="Locked"
                value={pipelineRows.reduce((n, r) => n + r.locked, 0)}
                hint="Assessments with locked final scores"
              />
            </ul>
          </div>
        )}
        <Interpretation>
          Draft assessments cannot be scored — publish them before the term closes.
        </Interpretation>
      </KanbanBoard>
    </div>
  );
}
