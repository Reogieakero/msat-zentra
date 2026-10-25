"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { CalendarDays, ChevronDown } from "lucide-react";
import { PrincipalEmptyState } from "../../../../components/PrincipalEmptyCard";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { apiClient } from "@/lib/api/client";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/providers";
import styles from "./SchoolTrend.module.css";

interface SubjectMeta {
  subjectId: string;
  code: string;
  name: string;
}

interface SubjectCell {
  subjectId: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
  ratio: number;
}

interface SubjectDay {
  date: string;
  isoDate: string;
  isWeekend: boolean;
  cells: SubjectCell[];
}

interface SubjectRow {
  sectionId: string;
  section: string;
  gradeLevel: string;
  enrolled: number;
  subjects: SubjectMeta[];
  days: SubjectDay[];
}

const AVG_KEY = "__avg";

/* Amber subject palette — the principal desk's single accent. Dark themes use
   the lighter end so lines stay legible on the dark surface. */
const AMBER_SHADES_LIGHT = [
  "#b45309",
  "#d97706",
  "#ea8a0a",
  "#f59e0b",
  "#f0a93b",
  "#f6c667",
  "#fadb9b",
  "#fdedc8",
];

const AMBER_SHADES_DARK = [
  "#fde68a",
  "#fcd34d",
  "#fbbf24",
  "#f59e0b",
  "#d97706",
  "#b45309",
  "#92400e",
  "#78350f",
];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const gradeNum = (level: string) => {
  const n = Number(String(level).replace(/\D/g, ""));
  return Number.isNaN(n) ? 0 : n;
};

export function SchoolTrend() {
  const { data, isPending } = useQuery({
    queryKey: ["attendance-section-subject-heatmap", "shared"],
    queryFn: async () => {
      const res = await apiClient.get<{
        sections: SubjectRow[];
        subjects: SubjectMeta[];
        schoolDays: number;
        term?: { id: string; termNumber: number };
      }>("/api/attendance/section-subject-heatmap", {
        params: { sharedOnly: true },
      });
      return res.data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
  const { resolvedTheme } = useTheme();

  const sections = React.useMemo(() => data?.sections ?? [], [data]);
  const termNumber = data?.term?.termNumber;

  const grades = React.useMemo(() => {
    const set = new Set(sections.map((s) => s.gradeLevel));
    return [...set].sort((a, b) => gradeNum(a) - gradeNum(b));
  }, [sections]);

  const [gradeFilter, setGradeFilter] = usePersistentState<string>(
    "zentra.attendance.trend.grade",
    "all"
  );

  const visibleSections = React.useMemo(
    () =>
      gradeFilter === "all"
        ? sections
        : sections.filter((s) => s.gradeLevel === gradeFilter),
    [sections, gradeFilter]
  );

  // One series per subject the visible sections actually offer.
  const series = React.useMemo(() => {
    const map = new Map<string, { key: string; code: string; name: string }>();
    for (const s of visibleSections) {
      for (const sub of s.subjects) {
        if (!map.has(sub.subjectId)) {
          map.set(sub.subjectId, {
            key: sub.subjectId,
            code: sub.code,
            name: sub.name,
          });
        }
      }
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [visibleSections]);

  const chartData = React.useMemo(() => {
    if (visibleSections.length === 0 || series.length === 0) return [];
    const axis = visibleSections[0]?.days ?? [];

    const indexBySection = new Map<string, Map<string, number>>();
    const enrolledBySubject = new Map<string, number>();
    for (const s of visibleSections) {
      const idx = new Map<string, number>();
      s.subjects.forEach((sub, i) => {
        idx.set(sub.subjectId, i);
        enrolledBySubject.set(
          sub.subjectId,
          (enrolledBySubject.get(sub.subjectId) ?? 0) + s.enrolled
        );
      });
      indexBySection.set(s.sectionId, idx);
    }

    return axis.map((axisDay, di) => {
      const row: Record<string, string | number> = { date: axisDay.date };
      let sum = 0;
      let n = 0;
      for (const item of series) {
        const enrolled = enrolledBySubject.get(item.key) ?? 0;
        let present = 0;
        for (const s of visibleSections) {
          const ci = indexBySection.get(s.sectionId)?.get(item.key);
          if (ci === undefined) continue;
          present += s.days[di]?.cells[ci]?.present ?? 0;
        }
        const rate = enrolled > 0 ? round1((present / enrolled) * 100) : 0;
        row[item.key] = rate;
        sum += rate;
        n += 1;
      }
      row[AVG_KEY] = n > 0 ? round1(sum / n) : 0;
      return row;
    });
  }, [visibleSections, series]);

  const colors = React.useMemo(
    () =>
      resolvedTheme === "dark" ? AMBER_SHADES_DARK : AMBER_SHADES_LIGHT,
    [resolvedTheme]
  );
  const colorOf = React.useCallback(
    (i: number) => colors[i % Math.max(1, colors.length)] ?? "#888888",
    [colors]
  );

  const ranked = React.useMemo(
    () =>
      chartData.length === 0
        ? []
        : series
            .map((item, i) => {
              const rates = chartData.map((d) => Number(d[item.key] ?? 0));
              const avg = rates.length
                ? rates.reduce((a, r) => a + r, 0) / rates.length
                : 0;
              const below = rates.filter((r) => r < 80).length;
              return {
                ...item,
                index: i,
                avg: round1(avg),
                below,
                days: rates.length,
              };
            })
            .toSorted((a, b) => b.avg - a.avg),
    [chartData, series]
  );

  const weakest = ranked.length > 0 ? ranked[ranked.length - 1]! : null;

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {
      [AVG_KEY]: { label: "Average", color: "var(--foreground)" },
    };
    series.forEach((item, i) => {
      config[item.key] = { label: item.code, color: colorOf(i) };
    });
    return config;
  }, [series, colorOf]);

  const filteredScope =
    gradeFilter === "all" ? "All grades" : `Grade ${gradeFilter}`;

  const interpretation = React.useMemo(() => {
    if (isPending || ranked.length === 0) return [];
    const scope = termNumber ? `Term ${termNumber}` : "this term";
    const overall =
      ranked.reduce((a, r) => a + r.avg, 0) / Math.max(1, ranked.length);
    const lines = [
      `Per-subject daily present share of enrolled headcount across ${ranked.length} subject${ranked.length === 1 ? "" : "s"}${gradeFilter === "all" ? " in all grades" : ` in Grade ${gradeFilter}`} — averaging ${round1(overall)}% in ${scope}.`,
    ];
    if (weakest) {
      lines.push(
        `Weakest: ${weakest.name} (${weakest.code}) at ${weakest.avg}% — ${weakest.below} of ${weakest.days} plotted day${weakest.below === 1 ? "" : "s"} below 80%.`
      );
    }
    const below80 = ranked.filter((r) => r.avg < 80).length;
    lines.push(
      below80 === 0
        ? "Every subject averages at or above the 80% mark — attendance on track."
        : `${below80} of ${ranked.length} subjects average${below80 === 1 ? "s" : ""} below 80% — at risk, needs attention.`
    );
    return lines;
  }, [isPending, ranked, termNumber, weakest, filteredScope]);

  const isEmpty = !isPending && (chartData.length === 0 || series.length === 0);

  return (
    <KanbanBoard
      title="Subject Trends"
      icon={<CalendarDays size={14} aria-hidden="true" />}
      count={isPending ? undefined : series.length}
      description="Daily present share of enrolled headcount for every subject offered in the selected grade — plotted against the school average."
      actions={
        <>
          <Pill tone="green" label="Data source">
            Adviser-shared
          </Pill>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={styles.filterBtn}>
                {filteredScope}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.filterMenu}>
              <DropdownMenuCheckboxItem
                checked={gradeFilter === "all"}
                onCheckedChange={() => setGradeFilter("all")}
              >
                All grades
              </DropdownMenuCheckboxItem>
              {grades.map((g) => (
                <DropdownMenuCheckboxItem
                  key={g}
                  checked={gradeFilter === g}
                  onCheckedChange={() => setGradeFilter(g)}
                >
                  Grade {g}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      {isEmpty ? (
        <PrincipalEmptyState
          icon={CalendarDays}
          title="No trend data yet"
          hint="No adviser-shared attendance trend is available for this grade and term."
        />
      ) : isPending ? (
        <>
          <Skeleton className={styles.skelChart} />
          <Skeleton className={styles.skelLine} />
          <Skeleton className={styles.skelLineShort} />
        </>
      ) : (
        <div className={styles.content}>
          <div className={styles.legend} aria-label="Subjects shown">
            {series.map((item, i) => {
              const stat = ranked.find((r) => r.key === item.key);
              return (
                <span key={item.key} className={styles.legendItem} title={item.name}>
                  <span
                    className={styles.chipSwatch}
                    style={{ background: colorOf(i) }}
                    aria-hidden
                  />
                  <span className={styles.legendCode}>{item.code}</span>
                  <span className={styles.legendValue}>{stat?.avg ?? 0}%</span>
                </span>
              );
            })}
            <span className={styles.legendItem}>
              <span
                className={styles.chipSwatch}
                style={{ background: "var(--foreground)" }}
                aria-hidden
              />
              <span className={styles.legendCode}>Average</span>
            </span>
          </div>

          <div className={styles.chartWrap}>
            <ChartContainer config={chartConfig} className={styles.chart}>
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 12, bottom: 0, left: -4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  minTickGap={32}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => `${label}`}
                      formatter={(value, name, item) => (
                        <div className="flex w-full items-center gap-2">
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                            style={{ background: item.color }}
                          />
                          <span className="text-muted-foreground">
                            {String(name)}
                          </span>
                          <span className="ml-auto font-mono font-medium tabular-nums">
                            {value}%
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                {series.map((item, i) => (
                  <Line
                    key={item.key}
                    type="monotone"
                    dataKey={item.key}
                    name={item.name}
                    stroke={colorOf(i)}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey={AVG_KEY}
                  name="Average"
                  stroke="var(--foreground)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </div>

          {interpretation.length > 0 ? (
            <p className={styles.interpretation}>
              <span className={styles.interpretationLabel}>
                What it means ·{" "}
              </span>
              {interpretation.join(" ")}
            </p>
          ) : null}
        </div>
      )}
    </KanbanBoard>
  );
}
