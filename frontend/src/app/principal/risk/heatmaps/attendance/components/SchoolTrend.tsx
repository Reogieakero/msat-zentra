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
import { MessageSquareText } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePrincipalProfileSettings } from "@/services/settings/profile-settings";
import { usePrimaryScale } from "@/components/risk-dashboard/use-primary-scale";
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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function SchoolTrend() {
  // Same query as the Subjects tab — shared cache, no extra request once
  // either tab has loaded. Per-take basis, consistent with subject blocks.
  const { data, isPending } = useQuery({
    queryKey: ["attendance-section-subject-heatmap", "all"],
    queryFn: async () => {
      const res = await apiClient.get<{
        sections: SubjectRow[];
        subjects: SubjectMeta[];
        schoolDays: number;
        term?: { id: string; termNumber: number };
      }>("/api/attendance/section-subject-heatmap");
      return res.data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
  const profile = usePrincipalProfileSettings();

  const sections = React.useMemo(() => data?.sections ?? [], [data]);
  const subjects = React.useMemo(() => data?.subjects ?? [], [data]);
  const termNumber = data?.term?.termNumber;

  // Grouping: one line per subject, or one line per grade level (pooled
  // across that grade's sections). Persisted per browser.
  const [mode, setMode] = usePersistentState<"subject" | "grade">(
    "zentra.attendance.trend.mode",
    "subject"
  );
  const noun = mode === "subject" ? "subject" : "grade level";
  const nounPlural = mode === "subject" ? "subjects" : "grade levels";

  const grades = React.useMemo(() => {
    const set = new Set(sections.map((s) => s.gradeLevel));
    return [...set].sort((a, b) => Number(a) - Number(b));
  }, [sections]);

  const series = React.useMemo(
    () =>
      mode === "subject"
        ? subjects.map((s) => ({
            key: s.subjectId,
            code: s.code,
            name: s.name,
          }))
        : grades.map((g) => ({
            key: `grade:${g}`,
            code: `G${g}`,
            name: `Grade ${g}`,
          })),
    [mode, subjects, grades]
  );

  // Daily school rate per series: pooled present ÷ pooled enrolled.
  // Subjects pool across offering sections; grades pool across the grade's
  // sections and subjects. Plus the mean-of-series average.
  const chartData = React.useMemo(() => {
    if (sections.length === 0 || series.length === 0) return [];
    const axis = sections[0]?.days ?? [];
    // Section → subjectId → cell index (cells align with row.subjects order).
    const indexBySection = new Map<string, Map<string, number>>();
    const enrolledBySubject = new Map<string, number>();
    const sectionsByGrade = new Map<string, SubjectRow[]>();
    for (const s of sections) {
      const idx = new Map<string, number>();
      s.subjects.forEach((sub, i) => {
        idx.set(sub.subjectId, i);
        enrolledBySubject.set(
          sub.subjectId,
          (enrolledBySubject.get(sub.subjectId) ?? 0) + s.enrolled
        );
      });
      indexBySection.set(s.sectionId, idx);
      if (!sectionsByGrade.has(s.gradeLevel))
        sectionsByGrade.set(s.gradeLevel, []);
      sectionsByGrade.get(s.gradeLevel)!.push(s);
    }
    return axis.map((axisDay, di) => {
      const row: Record<string, string | number> = { date: axisDay.date };
      let sum = 0;
      let n = 0;
      for (const item of series) {
        let present = 0;
        let enrolled = 0;
        if (mode === "subject") {
          enrolled = enrolledBySubject.get(item.key) ?? 0;
          for (const s of sections) {
            const ci = indexBySection.get(s.sectionId)?.get(item.key);
            if (ci === undefined) continue;
            present += s.days[di]?.cells[ci]?.present ?? 0;
          }
        } else {
          // Grade level: pool every take in the grade. The denominator is
          // headcount × offered subjects (one enrolled slot per take), so
          // the rate stays 0..100 on the same per-take basis as subjects.
          const grade = item.key.slice("grade:".length);
          const members = sectionsByGrade.get(grade) ?? [];
          for (const s of members) {
            const idx = indexBySection.get(s.sectionId);
            if (!idx || idx.size === 0) continue;
            enrolled += s.enrolled * idx.size;
            for (const ci of idx.values()) {
              present += s.days[di]?.cells[ci]?.present ?? 0;
            }
          }
        }
        const rate = enrolled > 0 ? round1((present / enrolled) * 100) : 0;
        row[item.key] = rate;
        sum += rate;
        n += 1;
      }
      row[AVG_KEY] = n > 0 ? round1(sum / n) : 0;
      return row;
    });
  }, [sections, series, mode]);

  // Every series line is a step of the viewer's own primary color (darkest
  // first) — one family, not many hues. The school-average line keeps its
  // contrast dashed style below.
  const colors = usePrimaryScale(series.length, profile.data?.primaryColor);
  const colorOf = React.useCallback(
    (i: number) => colors[i % Math.max(1, colors.length)] ?? "#888888",
    [colors]
  );

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {
      [AVG_KEY]: { label: "Average", color: "var(--foreground)" },
    };
    series.forEach((item, i) => {
      config[item.key] = { label: item.code, color: colorOf(i) };
    });
    return config;
  }, [series, colorOf]);

  // Clickable legend state. Null = defaults (only the average line and
  // the weakest series visible); the first toggle materializes the set so
  // manual picks survive refetches. Mode switches reset to defaults.
  const [hidden, setHidden] = React.useState<Set<string> | null>(null);
  // Mode switches reset to defaults — adjusted during render, never in an
  // effect (avoids cascading renders).
  const [prevMode, setPrevMode] = React.useState(mode);
  if (prevMode !== mode) {
    setPrevMode(mode);
    setHidden(null);
  }
  const toggle = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev ?? defaultHidden);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const resetLines = () => setHidden(null);
  // Worst-first ranking. Single-expression memo body (no early return, no
  // in-place mutation) so the React Compiler can preserve this memoization.
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
  const strongest = ranked[0] ?? null;
  const weakest = ranked.length > 0 ? ranked[ranked.length - 1]! : null;
  const seriesBelow80 = ranked.filter((r) => r.avg < 80).length;
  const atRisk = (weakest?.avg ?? 100) < 80;

  // Defaults hide every series except the weakest (+ the average, which is
  // never hidden by default). Used until the first manual toggle. Plain
  // derivation (not memoized): the compiler cannot preserve memoization of
  // a freshly built Set, and rebuilding it per render is negligible.
  const defaultHidden = (() => {
    const weakestKey = weakest?.key;
    return new Set(
      series.map((item) => item.key).filter((k) => k !== weakestKey)
    );
  })();
  const effectiveHidden = hidden ?? defaultHidden;

  const interpretation = React.useMemo(() => {
    if (isPending || ranked.length === 0) return [];
    const scope = termNumber ? `Term ${termNumber}` : "this term";
    const overall =
      ranked.reduce((a, r) => a + r.avg, 0) / Math.max(1, ranked.length);
    const lines = [
      `Per-${noun} daily present share of enrolled headcount across ${ranked.length} ${nounPlural} — averaging ${round1(overall)}% in ${scope}.`,
    ];
    if (weakest) {
      lines.push(
        `Weakest: ${weakest.name} (${weakest.code}) at ${weakest.avg}% — ${weakest.below} of ${weakest.days} plotted day${weakest.below === 1 ? "" : "s"} below 80%.`
      );
    }
    lines.push(
      seriesBelow80 === 0
        ? `Every ${noun} averages at or above the 80% mark — attendance on track.`
        : `${seriesBelow80} of ${ranked.length} ${nounPlural} average${seriesBelow80 === 1 ? "s" : ""} below 80% — at risk, needs attention.`
    );
    return lines;
  }, [isPending, ranked, termNumber, weakest, seriesBelow80, noun, nounPlural]);
  const statusLine =
    interpretation.length > 0 ? interpretation[interpretation.length - 1]! : null;
  const bodyLines =
    statusLine && interpretation.length > 1 ? interpretation.slice(0, -1) : interpretation;

  return (
      <Card>
        <CardHeader>
          <div>
            <CardTitle>
              {mode === "subject" ? "Subject Trends" : "Grade Trends"}
            </CardTitle>
            <CardDescription>
              One line per {noun} plus the school average — daily present
              share of enrolled headcount
              {termNumber ? ` · Term ${termNumber}` : ""}.
            </CardDescription>
          </div>
          <CardAction className="flex items-center gap-2">
            <div className="flex items-center gap-1" role="group" aria-label="Trend grouping">
              {(["subject", "grade"] as const).map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={mode === m ? "default" : "outline"}
                  size="sm"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                >
                  {m === "subject" ? "Subjects" : "Grades"}
                </Button>
              ))}
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-4">
          {isPending ? (
            <>
              <Skeleton className={styles.skelChart} />
              <Skeleton className={styles.skelLine} />
              <Skeleton className={styles.skelLineShort} />
            </>
          ) : chartData.length === 0 || series.length === 0 ? (
            <p className={styles.empty}>
              No trend data yet — blocks appear once school days elapse.
            </p>
          ) : (
            <>
              <div className={styles.chartWrap}>
                <ChartContainer config={chartConfig} className={styles.chart}>
                  <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--border)" }}
                      minTickGap={28}
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
                        name={item.code}
                        stroke={colorOf(i)}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        hide={effectiveHidden.has(item.key)}
                      />
                    ))}
                    <Line
                      type="monotone"
                      dataKey={AVG_KEY}
                      name="Average"
                      stroke="var(--foreground)"
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      dot={false}
                      activeDot={{ r: 4 }}
                      hide={effectiveHidden.has(AVG_KEY)}
                    />
                  </LineChart>
                </ChartContainer>
              </div>

              <div className={styles.legendRow} role="group" aria-label="Toggle trend lines">
                <button
                  type="button"
                  className={styles.chip}
                  aria-pressed={!effectiveHidden.has(AVG_KEY)}
                  data-off={effectiveHidden.has(AVG_KEY) ? true : undefined}
                  onClick={() => toggle(AVG_KEY)}
                  title="Toggle the school average line"
                >
                  <span
                    className={styles.chipSwatch}
                    style={{ background: "var(--foreground)" }}
                    aria-hidden
                  />
                  Average
                </button>
                {series.map((item, i) => {
                  const off = effectiveHidden.has(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={styles.chip}
                      aria-pressed={!off}
                      data-off={off ? true : undefined}
                      onClick={() => toggle(item.key)}
                      title={`${item.name} — toggle line`}
                    >
                      <span
                        className={styles.chipSwatch}
                        style={{ background: colorOf(i) }}
                        aria-hidden
                      />
                      {item.code}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`${styles.chip} ${styles.resetChip}`}
                  onClick={resetLines}
                  title="Show only the average and weakest lines"
                >
                  Reset
                </button>
              </div>

              {strongest && weakest ? (
                <div className={styles.dayRow}>
                  <div className={styles.dayCard}>
                    <p className={styles.dayLabel}>Strongest {noun}</p>
                    <p className={styles.dayDate}>
                      {strongest.name} · {strongest.code}
                    </p>
                    <p className={styles.dayRate}>{strongest.avg}%</p>
                  </div>
                  <div className={styles.dayCard}>
                    <p className={styles.dayLabel}>Weakest {noun}</p>
                    <p className={styles.dayDate}>
                      {weakest.name} · {weakest.code}
                    </p>
                    <p className={styles.dayRate}>{weakest.avg}%</p>
                  </div>
                </div>
              ) : null}
              {interpretation.length > 0 ? (
                <div className={styles.messageCol}>
                  <p className={styles.messageHead}>
                    <MessageSquareText
                      className={styles.messageIcon}
                      aria-hidden
                    />
                    What this means
                    {statusLine ? (
                      <Badge
                        variant={atRisk ? "destructive" : "success"}
                        className={styles.messageBadge}
                      >
                        {atRisk ? "Needs attention" : "On track"}
                      </Badge>
                    ) : null}
                  </p>
                  <p className={styles.messageSub}>
                    Auto-generated read of the per-{noun} trend
                    {termNumber ? ` for Term ${termNumber}` : ""}.
                  </p>
                  <ul className={styles.messageList}>
                    {[...bodyLines, ...(statusLine ? [statusLine] : [])].map(
                      (line, i) => (
                        <li key={i} className={styles.messageLine}>
                          {line}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
  );
}
