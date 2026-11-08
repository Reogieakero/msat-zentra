"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  Bar,
  BarChart,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays, Layers } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { InsightCallout } from "@/components/ui/insight-callout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ChartTooltip as DeskChartTooltip, CHART_TOOLTIP_WRAPPER } from "@/components/ui/chart-tooltip";
import { formatDate } from "@/lib/labels/datetime";
import {
  CATEGORY_KEYS,
  CATEGORY_META,
  fetchRecords,
} from "@/services/principal/records.service";
import type { BehavioralCategory, BehavioralRecord } from "../types";
import styles from "./RecordsCharts.module.css";

const categoryChartConfig = Object.fromEntries(
  CATEGORY_KEYS.map((key) => [
    key,
    { label: CATEGORY_META[key].label, color: CATEGORY_META[key].color },
  ]),
) satisfies ChartConfig;

function gradeSortKey(grade: string): number {
  const m = String(grade).match(/\d+/);
  return m ? Number(m[0]) : 99;
}

/** Prisma stores the enum as `G7`; the desk copy reads `Grade 7`. */
function gradeLabel(grade: string): string {
  return /^G\d+$/i.test(grade) ? `Grade ${grade.slice(1)}` : grade;
}

/** `YYYY-MM-DD` → local-midnight timestamp (avoids UTC day shift). */
function dayTimestamp(iso: string): number {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function isoOf(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

type GradeRow = { grade: string; label: string; total: number } & Record<
  BehavioralCategory,
  number
>;

type DateRow = { date: string; total: number } & Record<
  BehavioralCategory,
  number
>;

function emptyGradeRow(grade: string): GradeRow {
  return {
    grade,
    label: gradeLabel(grade),
    total: 0,
    behavioral: 0,
    bullying: 0,
    academic: 0,
    attendance: 0,
    health: 0,
  };
}

function emptyDateRow(date: string): DateRow {
  return {
    date,
    total: 0,
    behavioral: 0,
    bullying: 0,
    academic: 0,
    attendance: 0,
    health: 0,
  };
}

export function RecordsCharts() {
  const { data, isPending } = useQuery({
    queryKey: ["records-heatmap"],
    queryFn: fetchRecords,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { gradeRows, dateRows, allRecords } = React.useMemo(() => {
    const byGrade = new Map<string, GradeRow>();
    const byDate = new Map<string, DateRow>();
    const records: BehavioralRecord[] = [];

    for (const section of data?.sections ?? []) {
      for (const student of section.students) {
        for (const rec of student.behavioral) {
          records.push(rec);

          const grade =
            byGrade.get(section.gradeLevel) ?? emptyGradeRow(section.gradeLevel);
          byGrade.set(section.gradeLevel, grade);
          grade.total += 1;

          const dateRow = byDate.get(rec.date) ?? emptyDateRow(rec.date);
          byDate.set(rec.date, dateRow);
          dateRow.total += 1;

          const category = CATEGORY_KEYS.includes(rec.category)
            ? rec.category
            : "behavioral";
          grade[category] += 1;
          dateRow[category] += 1;
        }
      }
    }

    // Continuous daily series (zero-fill gaps) so the line reads as a timeline
    // rather than connecting only filing days.
    const filedDays = Array.from(byDate.values()).sort(
      (a, b) => dayTimestamp(a.date) - dayTimestamp(b.date),
    );
    const dateRows: DateRow[] = [];
    if (filedDays.length > 0) {
      const first = dayTimestamp(filedDays[0].date);
      const last = dayTimestamp(filedDays[filedDays.length - 1].date);
      for (let ts = first; ts <= last && dateRows.length < 400; ts += 86_400_000) {
        const key = isoOf(ts);
        dateRows.push(byDate.get(key) ?? emptyDateRow(key));
      }
    }

    return {
      gradeRows: Array.from(byGrade.values()).sort(
        (a, b) => gradeSortKey(a.grade) - gradeSortKey(b.grade),
      ),
      dateRows,
      allRecords: records,
    };
  }, [data]);

  const total = allRecords.length;

  const peakGrade = React.useMemo(
    () =>
      gradeRows.reduce<GradeRow | null>(
        (top, row) => (!top || row.total > top.total ? row : top),
        null,
      ),
    [gradeRows],
  );
  const peakDate = React.useMemo(
    () =>
      dateRows.reduce<DateRow | null>(
        (top, row) => (!top || row.total > top.total ? row : top),
        null,
      ),
    [dateRows],
  );
  const highTotal = React.useMemo(
    () => allRecords.filter((rec) => rec.severity === "High").length,
    [allRecords],
  );

  if (!isPending && total === 0) return null;

  return (
    <div className={styles.grid}>
      <KanbanBoard
        title="Records by grade level"
        icon={<Layers size={14} aria-hidden="true" />}
        count={isPending ? undefined : gradeRows.length}
        description="Anecdotal records per grade level, split by category for the active term."
        ariaLabel="Anecdotal records by grade level"
        className="h-full"
      >
        {isPending ? (
          <div className={styles.skeleton} aria-hidden>
            <Skeleton className={styles.skeletonChart} />
            <InsightCallout>
              <span className={styles.skeletonLine} />
            </InsightCallout>
          </div>
        ) : (
          <>
            <ChartContainer
              config={categoryChartConfig}
              className={styles.chart}
              style={{ height: 260, width: "100%", aspectRatio: "auto" }}
            >
              <BarChart
                accessibilityLayer
                data={gradeRows}
                barCategoryGap={22}
                margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend
                  verticalAlign="top"
                  align="right"
                  content={<ChartLegendContent />}
                />
                {CATEGORY_KEYS.map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={categoryChartConfig[key].label as string}
                    fill={`var(--color-${key})`}
                    stackId="records"
                    maxBarSize={42}
                  />
                ))}
              </BarChart>
            </ChartContainer>

            <InsightCallout className="mt-auto">
              <strong>What it means · </strong>
              {peakGrade ? (
                <>
                  <strong>{peakGrade.label}</strong> carries the heaviest record
                  load — <strong>{peakGrade.total}</strong> of{" "}
                  <strong>{total}</strong> record{total === 1 ? "" : "s"} (
                  {Math.round((peakGrade.total / total) * 100)}%). Across the
                  school, <strong>{highTotal}</strong> record
                  {highTotal === 1 ? " is" : "s are"} high severity.
                </>
              ) : (
                <>No anecdotal records were filed for the active term.</>
              )}
            </InsightCallout>
          </>
        )}
      </KanbanBoard>

      <KanbanBoard
        title="Records filed over time"
        icon={<CalendarDays size={14} aria-hidden="true" />}
        count={isPending ? undefined : total}
        description="Anecdotal records filed per day this term, split by category."
        ariaLabel="Anecdotal records filed over time"
        className="h-full"
      >
        {isPending ? (
          <div className={styles.skeleton} aria-hidden>
            <Skeleton className={styles.skeletonChart} />
            <InsightCallout>
              <span className={styles.skeletonLine} />
            </InsightCallout>
          </div>
        ) : (
          <>
            <div
              className={styles.lineChart}
              role="img"
              aria-label={`Anecdotal records filed per day: ${dateRows
                .map((d) => `${d.date} ${d.total}`)
                .join("; ")}`}
            >
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={dateRows}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
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
                    content={
                      <DeskChartTooltip
                        formatLabel={(label) => formatDate(String(label))}
                      />
                    }
                    wrapperStyle={CHART_TOOLTIP_WRAPPER}
                  />
                  <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                  {CATEGORY_KEYS.map((key) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={categoryChartConfig[key].label as string}
                      stroke={categoryChartConfig[key].color as string}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <InsightCallout className="mt-auto">
              <strong>What it means · </strong>
              {peakDate ? (
                <>
                  <strong>{total}</strong> record{total === 1 ? "" : "s"} were
                  filed across <strong>{dateRows.length}</strong> day
                  {dateRows.length === 1 ? "" : "s"}. The busiest day was{" "}
                  <strong>{formatDate(peakDate.date)}</strong> with{" "}
                  <strong>{peakDate.total}</strong> filing
                  {peakDate.total === 1 ? "" : "s"}.
                </>
              ) : (
                <>No anecdotal records were filed for the active term.</>
              )}
            </InsightCallout>
          </>
        )}
      </KanbanBoard>
    </div>
  );
}
