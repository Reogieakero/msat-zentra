"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { useTheme } from "@/components/providers";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookOpen, ChevronDown } from "lucide-react";
import { PrincipalEmptyState } from "../../../../components/PrincipalEmptyCard";
import {
  ALL_GRADES,
  gradeSortKey,
  round1,
  type BackendSectionRow,
} from "./types";
import styles from "./academics.module.css";

/* Amber subject palette — same accent family as the attendance and risk
   boards. Dark themes use the lighter end so bars stay legible. */
const AMBER_SHADES_LIGHT = [
  "#b45309",
  "#d97706",
  "#ea8a0a",
  "#f59e0b",
  "#f0a93b",
  "#f6c667",
];

const AMBER_SHADES_DARK = [
  "#fde68a",
  "#fcd34d",
  "#fbbf24",
  "#f59e0b",
  "#d97706",
  "#b45309",
];

type TrendRow = {
  subject: string;
  [key: string]: string | number | null;
};

type CellStat = { avg: number; graded: number; below: number };

function GradeFilterMenu({
  grades,
  gradeFilter,
  onGradeFilterChange,
}: {
  grades: string[];
  gradeFilter: string;
  onGradeFilterChange: (grade: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={styles.trendGradeBtn}>
          {gradeFilter}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={styles.trendGradeMenu}>
        {[...grades]
          .sort((a, b) => gradeSortKey(a) - gradeSortKey(b))
          .map((g) => (
            <DropdownMenuItem
              key={g}
              onSelect={() => onGradeFilterChange(g)}
              className={styles.trendGradeItem}
            >
              <span>{g}</span>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SubjectTrendChart({
  sections,
  subjects,
  grades,
  gradeFilter,
  onGradeFilterChange,
  isPending,
  selectedSubject,
  onSelectSubject,
}: {
  sections: BackendSectionRow[];
  subjects: string[];
  grades: string[];
  gradeFilter: string;
  onGradeFilterChange: (grade: string) => void;
  isPending: boolean;
  selectedSubject: string | null;
  onSelectSubject: (subject: string | null) => void;
}) {
  const { resolvedTheme } = useTheme();

  const activeGrades = React.useMemo(() => {
    const inScope =
      gradeFilter === ALL_GRADES
        ? sections
        : sections.filter((s) => s.grade === gradeFilter);
    return (
      gradeFilter === ALL_GRADES
        ? grades
        : grades.filter((g) => g === gradeFilter)
    ).filter((g) => inScope.some((s) => s.grade === g));
  }, [sections, grades, gradeFilter]);

  const series = React.useMemo(() => {
    const shades =
      resolvedTheme === "dark" ? AMBER_SHADES_DARK : AMBER_SHADES_LIGHT;
    return activeGrades.map((grade, i) => ({
      key: `g${i}`,
      grade,
      color: shades[i % shades.length],
    }));
  }, [activeGrades, resolvedTheme]);

  const { chartData, detailByKey } = React.useMemo(() => {
    const inScope =
      gradeFilter === ALL_GRADES
        ? sections
        : sections.filter((s) => s.grade === gradeFilter);

    const acc = new Map<
      string,
      Map<string, { sum: number; count: number; below: number }>
    >();
    for (const s of inScope) {
      for (const st of s.students) {
        for (const subj of st.subjects) {
          let byGrade = acc.get(subj.subject);
          if (!byGrade) {
            byGrade = new Map();
            acc.set(subj.subject, byGrade);
          }
          const entry = byGrade.get(s.grade) ?? { sum: 0, count: 0, below: 0 };
          entry.sum += subj.transmutedGrade;
          entry.count += 1;
          if (subj.transmutedGrade < 75) entry.below += 1;
          byGrade.set(s.grade, entry);
        }
      }
    }

    const detail: Record<string, CellStat> = {};
    const rows: TrendRow[] = subjects.map((subj) => {
      const row: TrendRow = { subject: subj };
      const byGrade = acc.get(subj);
      series.forEach((item) => {
        const entry = byGrade?.get(item.grade);
        if (entry && entry.count > 0) {
          const avg = round1(entry.sum / entry.count);
          row[item.key] = avg;
          detail[`${subj}::${item.grade}`] = {
            avg,
            graded: entry.count,
            below: entry.below,
          };
        } else {
          row[item.key] = null;
        }
      });
      return row;
    });
    return { chartData: rows, detailByKey: detail };
  }, [sections, subjects, gradeFilter, series]);

  const belowCount = React.useMemo(
    () => Object.values(detailByKey).filter((d) => d.avg < 75).length,
    [detailByKey]
  );
  const lowest = React.useMemo(() => {
    let min: { key: string; stat: CellStat } | null = null;
    for (const [key, stat] of Object.entries(detailByKey)) {
      if (!min || stat.avg < min.stat.avg) min = { key, stat };
    }
    return min;
  }, [detailByKey]);

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {};
    series.forEach((item) => {
      config[item.key] = { label: item.grade, color: item.color };
    });
    return config;
  }, [series]);

  const hasData = chartData.some((row) =>
    series.some((item) => row[item.key] != null)
  );

  const isEmpty = !isPending && !hasData;
  if (isEmpty) {
    return (
      <KanbanBoard
        title="Subject Trends"
        icon={<BookOpen size={14} aria-hidden="true" />}
        actions={
          <GradeFilterMenu
            grades={grades}
            gradeFilter={gradeFilter}
            onGradeFilterChange={onGradeFilterChange}
          />
        }
        ariaLabel="Subject trends"
      >
        <PrincipalEmptyState
          icon={BookOpen}
          title="No graded records"
          hint="No graded records for the active term. Grades will appear here once finalized."
        />
      </KanbanBoard>
    );
  }

  return (
    <KanbanBoard
      title="Subject Trends"
      icon={<BookOpen size={14} aria-hidden="true" />}
      count={isPending ? undefined : subjects.length}
      description={
        gradeFilter === ALL_GRADES
          ? "Average transmuted grade per subject, one bar per grade level — click a bar to rank its sections."
          : `Average transmuted grade per subject for ${gradeFilter} — click a bar to rank its sections.`
      }
      actions={
        <GradeFilterMenu
          grades={grades}
          gradeFilter={gradeFilter}
          onGradeFilterChange={onGradeFilterChange}
        />
      }
      ariaLabel="Subject trends"
    >
      {isPending ? (
        <Skeleton className={styles.chartSkel} aria-hidden />
      ) : (
        <div className={styles.chartBody}>
          <div className={styles.chartScroll}>
            <div className={styles.chartInner}>
              <ChartContainer
                config={chartConfig}
                className={styles.chartContainer}
                style={{ height: 320, width: "100%", aspectRatio: "auto" }}
              >
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
              className={styles.chartClickable}
              onClick={(state) => {
                const label =
                  state && typeof state.activeLabel === "string"
                    ? state.activeLabel
                    : null;
                if (!label) return;
                onSelectSubject(label === selectedSubject ? null : label);
              }}
            >
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="subject"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
                angle={-18}
                textAnchor="end"
                height={72}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                domain={[50, 100]}
                ticks={[50, 60, 70, 75, 80, 90, 100]}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              {series.length > 1 ? (
                <ChartLegend
                  verticalAlign="top"
                  align="right"
                  content={<ChartLegendContent />}
                />
              ) : null}
              <ReferenceLine
                y={75}
                stroke="var(--destructive)"
                strokeDasharray="6 4"
                label={{
                  value: "Passing (75)",
                  position: "insideTopRight",
                  fontSize: 11,
                  fill: "var(--destructive)",
                }}
              />
              {series.map((item) => (
                <Bar
                  key={item.key}
                  dataKey={item.key}
                  name={item.grade}
                  fill={`var(--color-${item.key})`}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              ))}
            </BarChart>
              </ChartContainer>
            </div>
          </div>

          <div className={styles.dotLegend} aria-label="Chart actions">
            {selectedSubject ? (
              <span className={styles.dotLegendSelected}>
                Selected: {selectedSubject} (click again to clear)
              </span>
            ) : (
              <span className={styles.dotLegendHint}>
                Click any bar to rank its sections
              </span>
            )}
          </div>

          <p className={styles.interpretation}>
            <span className={styles.interpretationLabel}>What it means · </span>
            {belowCount === 0
              ? "Every subject trend sits at or above 75 — clear."
              : lowest
                ? `${belowCount} grade–subject point${belowCount === 1 ? "" : "s"} below 75. Lowest: ${lowest.key.replace("::", " · ")} at ${lowest.stat.avg}.`
                : `${belowCount} grade–subject points below 75.`}
          </p>
        </div>
      )}
    </KanbanBoard>
  );
}
