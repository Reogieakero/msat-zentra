"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  AlertTriangle,
  GraduationCap,
  Gauge,
  BookOpen,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useGradeMode } from "../../../../grade-mode-context";
import styles from "./AcademicInsights.module.css";

type BackendSubject = { subject: string; transmutedGrade: number };
type BackendStudent = {
  studentId: string;
  name: string;
  riskLevel: "High" | "Moderate" | "Low";
  overallAverage: number;
  subjects: BackendSubject[];
};
type BackendSection = {
  sectionId: string;
  section: string;
  grade: string;
  avgTransmuted: number;
  passPct: number;
  failPct: number;
  atRiskCount: number;
  students: BackendStudent[];
};
type PassFailByGrade = { grade: string; passed: number; failed: number };
type Insight = {
  tone: "good" | "warn";
  title: string;
  body: string;
};
type BackendAcademicSummary = {
  schoolYear: string;
  termLabel: string;
  sections: BackendSection[];
  passFailByGrade: PassFailByGrade[];
};

const passFailConfig = {
  passed: { label: "Passed", color: "var(--primary)" },
  failed: { label: "Failed", color: "var(--destructive)" },
} satisfies ChartConfig;

const subjectStackConfig = {
  passed: { label: "Passed", color: "var(--primary)" },
  below: { label: "Below 75", color: "var(--destructive)" },
} satisfies ChartConfig;

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

function studentBelow75(st: BackendStudent): boolean {
  return st.overallAverage < 75;
}

function toneWord(p: number): string {
  if (p >= 90) return "strong";
  if (p >= 80) return "healthy";
  if (p >= 70) return "fair";
  return "concerning";
}

function Donut({ value, total, color }: { value: number; total: number; color: string }) {
  const pid = Math.min(100, Math.max(0, total > 0 ? (value / total) * 100 : 0));
  return (
    <div
      className={styles.donut}
      style={{
        background: `conic-gradient(${color} ${pid}%, color-mix(in oklch, var(--foreground), transparent 92%) ${pid}% 100%)`,
      }}
      aria-hidden
    >
      <div className={styles.donutHole}>{value}</div>
    </div>
  );
}

type ChartTipRow = { label: string; value: React.ReactNode; color: string };
type ChartTipState = {
  x: number;
  y: number;
  flip: boolean;
  content: React.ReactNode;
} | null;

function ChartTipContent({
  title,
  rows,
}: {
  title?: string;
  rows: ChartTipRow[];
}) {
  return (
    <div className="grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {title ? <div className="font-medium">{title}</div> : null}
      <div className="grid gap-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex w-full flex-wrap items-center gap-2">
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: r.color }}
              aria-hidden
            />
            <div className="flex flex-1 items-center justify-between gap-2 leading-none">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-mono font-medium text-foreground tabular-nums">{r.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartFloater({ tip }: { tip: ChartTipState }) {
  if (!tip) return null;
  return (
    <div
      className={styles.tipLayer}
      style={{
        left: tip.x,
        top: tip.y,
        transform: tip.flip ? "translate(calc(-100% - 12px), -50%)" : "translate(12px, -50%)",
      }}
    >
      {tip.content}
    </div>
  );
}

function useChartTip<T>(items: T[], makeContent: (item: T) => React.ReactNode) {
  const [tip, setTip] = React.useState<ChartTipState>(null);

  const listProps = {
    onMouseMove: (e: React.MouseEvent<HTMLUListElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const row = (e.target as Element).closest("li[data-tip-index]") as HTMLLIElement | null;
      if (!row) return;
      const index = Number(row.dataset.tipIndex);
      const item = items[index];
      if (!item) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setTip({
        x,
        y,
        flip: x > rect.width - 220,
        content: makeContent(item),
      });
    },
    onMouseLeave: () => setTip(null),
  };

  return { tip, listProps };
}

export function AcademicInsights({
  selectedId,
  onSelectId,
  onClearSection,
}: {
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  onClearSection: () => void;
}) {
  const { gradeMode, setGradeMode } = useGradeMode();

  const { data, isPending } = useQuery({
    queryKey: ["academic-insights", gradeMode],
    queryFn: async () => {
      const res = await apiClient.get<BackendAcademicSummary>("/api/academics", {
        params: { mode: gradeMode },
      });
      return res.data;
    },
  });

  const sections = React.useMemo(() => data?.sections ?? [], [data]);
  const selected = React.useMemo(
    () => sections.find((s) => s.sectionId === selectedId) ?? null,
    [sections, selectedId]
  );

  const students = React.useMemo(
    () => (selected ? selected.students : sections.flatMap((s) => s.students)),
    [sections, selected]
  );
  const total = students.length;
  const below = React.useMemo(() => students.filter(studentBelow75).length, [students]);

  const passFailByGrade = React.useMemo(() => data?.passFailByGrade ?? [], [data]);

  // ---- KPI + narrative derivations ----
  const riskySections = React.useMemo(
    () => sections.filter((s) => s.students.some(studentBelow75)),
    [sections]
  );
  const avgPass = React.useMemo(
    () =>
      sections.length
        ? round1(sections.reduce((a, s) => a + s.passPct, 0) / sections.length)
        : 0,
    [sections]
  );

  const { subjectRanking, worstSubject } = React.useMemo(() => {
    const map = new Map<string, number>();
    const enrolled = new Map<string, number>();
    for (const s of sections) {
      for (const st of s.students) {
        for (const subj of st.subjects) {
          enrolled.set(subj.subject, (enrolled.get(subj.subject) ?? 0) + 1);
          if (subj.transmutedGrade < 75) {
            map.set(subj.subject, (map.get(subj.subject) ?? 0) + 1);
          }
        }
      }
    }
    const ranking = Array.from(map.entries())
      .map(([subject, count]) => ({
        subject,
        count,
        enrolled: enrolled.get(subject) ?? 0,
      }))
      .sort((a, b) => b.count - a.count);
    return { subjectRanking: ranking, worstSubject: ranking[0] ?? null };
  }, [sections]);

  const sectionRanking = React.useMemo(
    () => [...sections].sort((a, b) => b.avgTransmuted - a.avgTransmuted),
    [sections]
  );
  const maxSubjectCount = subjectRanking[0]?.count ?? 1;

  const sectionLo = React.useMemo(
    () => sectionRanking.reduce((a, s) => Math.min(a, s.avgTransmuted), 100),
    [sectionRanking]
  );
  const sectionHi = React.useMemo(
    () => sectionRanking.reduce((a, s) => Math.max(a, s.avgTransmuted), 0),
    [sectionRanking]
  );
  const refPos =
    sectionHi === sectionLo ? 0 : Math.max(0, Math.min(100, ((75 - sectionLo) / (sectionHi - sectionLo)) * 100));

  const subjectComposition = React.useMemo(
    () =>
      subjectRanking.slice(0, 8).map((subj) => ({
        subject: subj.subject,
        passed: Math.max(0, subj.enrolled - subj.count),
        below: subj.count,
      })),
    [subjectRanking]
  );

  const subjectInterpretation = React.useMemo(() => {
    if (subjectRanking.length === 0) return "";
    const top = subjectRanking[0];
    const allBelow = subjectRanking.reduce((a, s) => a + s.count, 0);
    const topFive = subjectRanking.slice(0, 5).reduce((a, s) => a + s.count, 0);
    const topFailPct = pct(top.count, top.enrolled);
    let text = `${top.subject} is the most-failing subject with ${top.count} students below 75 (${topFailPct}% of its ${top.enrolled} graded this term).`;
    if (subjectRanking.length > 1) {
      text += ` The five worst subjects account for ${pct(topFive, allBelow)}% of all ${allBelow} subject failures.`;
    }
    return text;
  }, [subjectRanking]);

  const subjectCompositionInterpretation = React.useMemo(() => {
    if (subjectComposition.length === 0) return "";
    const graded = subjectComposition.reduce((a, s) => a + s.passed + s.below, 0);
    const passed = subjectComposition.reduce((a, s) => a + s.passed, 0);
    const overall = pct(passed, graded);
    const rate = (s: { passed: number; below: number }) => pct(s.passed, s.passed + s.below);
    const worst = subjectComposition.reduce((a, s) => (rate(s) < rate(a) ? s : a), subjectComposition[0]);
    const best = subjectComposition.reduce((a, s) => (rate(s) > rate(a) ? s : a), subjectComposition[0]);
    let text = `${overall}% of students across these graded subjects passed, with the rest below 75.`;
    if (subjectComposition.length > 1) {
      text += ` ${best.subject} is the strongest here (${rate(best)}% passing), while ${worst.subject} is the weakest (${rate(worst)}% passing).`;
    }
    return text;
  }, [subjectComposition]);

  const passRateInterpretation = React.useMemo(() => {
    if (sectionRanking.length === 0) return "";
    const avg = Math.round(sectionRanking.reduce((a, s) => a + s.passPct, 0) / sectionRanking.length);
    const best = sectionRanking.reduce((a, s) => (s.passPct > a.passPct ? s : a), sectionRanking[0]);
    const worst = sectionRanking.reduce((a, s) => (s.passPct < a.passPct ? s : a), sectionRanking[0]);
    let text = `Sections average ${avg}% passing across ${sectionRanking.length} classes.`;
    if (sectionRanking.length > 1) {
      text += ` ${best.section} leads at ${best.passPct}%, while ${worst.section} trails at ${worst.passPct}%${worst.passPct < 75 ? " — under the 75% target" : ""}.`;
    }
    return text;
  }, [sectionRanking]);

  const sectionSpread = React.useMemo(
    () =>
      sectionRanking.map((s) => {
        const avgs = s.students.map((st) => st.overallAverage);
        const min = avgs.length > 0 ? Math.min(...avgs) : s.avgTransmuted;
        const max = avgs.length > 0 ? Math.max(...avgs) : s.avgTransmuted;
        const pct = (v: number) => Math.max(0, Math.min(100, ((v - 50) / (100 - 50)) * 100));
        return { section: s.section, min, max, avg: s.avgTransmuted, minPct: pct(min), maxPct: pct(max), avgPct: pct(s.avgTransmuted) };
      }),
    [sectionRanking]
  );

  const spreadInterpretation = React.useMemo(() => {
    if (sectionSpread.length === 0) return "";
    const span = (s: (typeof sectionSpread)[number]) => s.max - s.min;
    const widest = sectionSpread.reduce((a, s) => (span(s) > span(a) ? s : a), sectionSpread[0]);
    const belowCount = sectionSpread.filter((s) => s.min < 75).length;
    let text = `${widest.section} shows the widest spread of student averages (${widest.min} to ${widest.max}).`;
    text +=
      belowCount > 0
        ? ` ${belowCount} of ${sectionSpread.length} sections contain at least one student below 75.`
        : ` No section dips below 75 — every class stays above the passing mark.`;
    return text;
  }, [sectionSpread]);

  const kpiTiles = React.useMemo(() => {
    const belowPct = pct(below, total);
    const riskyPct = pct(riskySections.length, sections.length);
    return [
      {
        icon: AlertTriangle,
        label: "Students below 75",
        value: below.toLocaleString(),
        sub: `${belowPct}% of ${total.toLocaleString()} graded`,
        tone: below > 0 ? "warn" : "good",
        text: `${below} of ${total} students (${belowPct}%) are under the 75% passing mark.`,
        chart: total > 0 ? <Donut value={below} total={total} color="var(--destructive)" /> : null,
      },
      {
        icon: GraduationCap,
        label: "Sections at risk",
        value: String(riskySections.length),
        sub: `of ${sections.length} sections`,
        tone: riskySections.length > 0 ? "warn" : "good",
        text: `${riskySections.length} of ${sections.length} sections have at least one learner below 75.`,
        chart: (
          <div className={styles.microTrack}>
            <div
              className={styles.microFill}
              style={{ width: `${riskyPct}%`, background: "var(--destructive)" }}
            />
          </div>
        ),
      },
      {
        icon: Gauge,
        label: "Avg passing",
        value: `${avgPass}%`,
        sub: "across sections",
        tone: avgPass >= 80 ? "good" : "warn",
        text: `Sections average ${avgPass}% passing — ${toneWord(avgPass)}.`,
        chart: (
          <div className={styles.microTrack}>
            <div
              className={styles.microFill}
              style={{
                width: `${avgPass}%`,
                background: avgPass >= 80 ? "var(--primary)" : "var(--destructive)",
              }}
            />
          </div>
        ),
      },
      {
        icon: BookOpen,
        label: "Highest failure subject",
        value: worstSubject ? worstSubject.subject : "—",
        sub: worstSubject ? `${worstSubject.count} below 75` : "status-only",
        tone: worstSubject && worstSubject.count > 0 ? "warn" : "good",
        text: worstSubject
          ? `${worstSubject.subject} leads failures (${worstSubject.count} students below 75 of ${worstSubject.enrolled} graded).`
          : "No subject failures recorded.",
        chart: worstSubject ? (
          <div className={styles.microTrack}>
            <div
              className={styles.microFill}
              style={{
                width: `${pct(worstSubject.count, maxSubjectCount)}%`,
                background: "var(--destructive)",
              }}
            />
          </div>
        ) : null,
      },
    ];
  }, [
    below,
    total,
    riskySections.length,
    sections.length,
    avgPass,
    worstSubject,
    maxSubjectCount,
  ]);

  // Meaningful insights derived from the pass/fail-by-grade distribution.
  const insights = React.useMemo<Insight[]>(() => {
    const pf = passFailByGrade;
    if (pf.length === 0) return [];
    const totalPassed = pf.reduce((a, g) => a + g.passed, 0);
    const totalFailed = pf.reduce((a, g) => a + g.failed, 0);
    const enrolled = totalPassed + totalFailed;
    const overall = pct(totalPassed, enrolled);
    const rate = (g: PassFailByGrade) => g.passed / (g.passed + g.failed || 1) || 0;
    const best = pf.reduce((a, g) => (rate(g) > rate(a) ? g : a), pf[0]);
    const worst = pf.reduce((a, g) => (rate(g) < rate(a) ? g : a), pf[0]);

    const list: Insight[] = [
      {
        tone: "good",
        title: "Overall pass rate",
        body: `${overall}% of ${enrolled.toLocaleString()} graded students pass across every grade level this term.`,
      },
      {
        tone: "good",
        title: `Grade ${best.grade} leads`,
        body: `${pct(best.passed, best.passed + best.failed)}% of its ${best.passed + best.failed} graded students passed — the strongest level this term.`,
      },
      {
        tone: "warn",
        title: `Grade ${worst.grade} lags`,
        body: `${pct(worst.passed, worst.passed + worst.failed)}% of its ${worst.passed + worst.failed} graded students passed — the weakest level this term.`,
      },
    ];

    if (rate(worst) < 0.75) {
      list.push({
        tone: "warn",
        title: "Below the passing threshold",
        body: `Grade ${worst.grade} sits under the 75% passing mark and is flagged for review.`,
      });
    } else {
      list.push({
        tone: "good",
        title: "Within the passing threshold",
        body: "Every grade level holds at least 75% passing — no level dips below the mark.",
      });
    }

    return list;
  }, [passFailByGrade]);

  const { tip: subjectLolliTip, listProps: subjectLolliProps } = useChartTip(
    subjectRanking.slice(0, 8),
    (subj) => (
      <ChartTipContent
        title={subj.subject}
        rows={[
          { label: "Students below 75", value: subj.count, color: "var(--destructive)" },
          { label: "Graded", value: subj.enrolled, color: "var(--primary)" },
          { label: "Fail rate", value: `${pct(subj.count, subj.enrolled)}%`, color: "var(--destructive)" },
        ]}
      />
    )
  );

  const { tip: passRateTip, listProps: passRateProps } = useChartTip(sectionRanking, (s) => (
    <ChartTipContent
      title={s.section}
      rows={[
        { label: "Passing", value: `${s.passPct}%`, color: "var(--primary)" },
        { label: "Failing", value: `${s.failPct}%`, color: "var(--destructive)" },
        { label: "At risk", value: s.atRiskCount, color: "var(--destructive)" },
      ]}
    />
  ));

  const { tip: spreadTip, listProps: spreadProps } = useChartTip(sectionSpread, (s) => (
    <ChartTipContent
      title={s.section}
      rows={[
        {
          label: "Lowest student",
          value: s.min,
          color: s.min < 75 ? "var(--destructive)" : "var(--primary)",
        },
        { label: "Section average", value: s.avg, color: "var(--foreground)" },
        { label: "Highest student", value: s.max, color: "var(--primary)" },
      ]}
    />
  ));

  const isLoading = isPending;

  return (
    <div className={styles.stack}>
      {/* Headline KPIs */}
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <CardTitle>Performance insights</CardTitle>
            <CardDescription>
              {data?.schoolYear ?? "…"} &middot; {data?.termLabel ?? "…"} &middot;{" "}
              {gradeMode === "final" ? "finalized grades only" : "all graded rows (preview)"}
            </CardDescription>
          </div>
          <CardAction className={styles.headerActions}>
            <Tabs value={gradeMode} onValueChange={(v) => setGradeMode(v as "raw" | "final")}>
              <TabsList className={styles.tabList}>
                <TabsTrigger value="final" className={styles.tabTrigger}>
                  Finalized
                </TabsTrigger>
                <TabsTrigger value="raw" className={styles.tabTrigger}>
                  All rows
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {selected ? (
              <Badge variant="secondary">{selected.section}</Badge>
            ) : null}
          </CardAction>
        </CardHeader>
        <CardContent className={styles.content}>
          <div className={styles.kpiGrid}>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={styles.kpiCard}>
                    <Skeleton className={styles.kpiValueSkel} />
                  </div>
                ))
              : kpiTiles.map((k) => (
                  <div key={k.label} className={`${styles.kpiCard} ${styles[`tone_${k.tone}`]}`}>
                    <div className={styles.kpiHead}>
                      <div className={styles.kpiIcon}>
                        <k.icon className={styles.kpiIconSvg} aria-hidden />
                      </div>
                      {k.chart}
                    </div>
                    <div className={styles.kpiBody}>
                      <span className={styles.kpiValue}>{k.value}</span>
                      <span className={styles.kpiLabel}>{k.label}</span>
                      <span className={styles.kpiSub}>{k.sub}</span>
                    </div>
                    <p className={styles.kpiText}>{k.text}</p>
                  </div>
                ))}
          </div>
        </CardContent>
      </Card>

      {/* Pass/fail insights (plain text) + chart (card) */}
      <section className={styles.section}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <CardTitle>Pass vs fail by grade level</CardTitle>
            <CardDescription>
              Students per grade level that passed or failed this term
            </CardDescription>
          </div>
        </div>
        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.split}>
              <Skeleton className={styles.insightsSkel} />
              <Skeleton className={styles.chartSkel} />
            </div>
          ) : passFailByGrade.length === 0 ? (
            <p className={styles.empty}>No graded records for the active term.</p>
          ) : (
            <div className={styles.split}>
              <div className={styles.insightsCol}>
                <h3 className={styles.insightsHead}>What the numbers say</h3>
                <ul className={styles.insightsList}>
                  {insights.map((ins) => (
                    <li
                      key={ins.title}
                      className={`${styles.insightItem} ${styles[`insight_${ins.tone}`]}`}
                    >
                      <span className={styles.insightMarker} aria-hidden />
                      <div className={styles.insightBody}>
                        <span className={styles.insightTitle}>{ins.title}</span>
                        <p className={styles.insightText}>{ins.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.chartCol}>
                <ChartContainer config={passFailConfig} className={styles.chart}>
                  <BarChart data={passFailByGrade} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="grade" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="passed" stackId="a" fill="var(--primary)" />
                    <Bar dataKey="failed" stackId="a" radius={[3, 3, 0, 0]} fill="var(--destructive)" />
                  </BarChart>
                </ChartContainer>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Ranked bars with commentary */}
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <CardTitle>Rankings</CardTitle>
            <CardDescription>
              {selected
                ? "Per-student in this section"
                : "Section averages and pass rates, plus subject failure and composition"}
            </CardDescription>
          </div>
          {selected ? (
            <CardAction className={styles.headerActions}>
              <button
                type="button"
                className={styles.closeBtn}
                  onClick={() => onClearSection()}
              >
                <X className={styles.closeIcon} aria-hidden />
                Close
              </button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className={styles.content}>
          {isLoading ? (
            <div className={styles.rankSkel}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className={styles.rankSkelRow} />
              ))}
            </div>
          ) : selected ? (
            <Table>
              {[...selected.students]
                .sort((a, b) => a.overallAverage - b.overallAverage)
                .map((st) => (
                  <tr key={st.studentId}>
                    <td className={styles.colLeft}>{st.name}</td>
                    <td>
                      <Badge variant={st.overallAverage < 75 ? "destructive" : "outline"}>
                        {st.overallAverage}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={st.riskLevel === "High" ? "destructive" : st.riskLevel === "Moderate" ? "secondary" : "outline"}>
                        {st.riskLevel}
                      </Badge>
                    </td>
                  </tr>
                ))}
            </Table>
          ) : (
            <div className={styles.gallery}>
              {/* Threshold bars: sections by average */}
              <section className={`${styles.panel} ${styles.galleryFull}`}>
                <h3 className={styles.panelTitle}>Sections by average</h3>
                <ul className={styles.rankList}>
                  {sectionRanking.map((s, i) => {
                    const w =
                      sectionHi === sectionLo
                        ? 100
                        : (s.avgTransmuted - sectionLo) / (sectionHi - sectionLo) * 100;
                    return (
                      <li key={s.sectionId} className={styles.rankItem}>
                        <button
                          type="button"
                          className={`${styles.rankHead} ${selectedId === s.sectionId ? styles.rankOn : ""}`}
                          onClick={() => onSelectId(s.sectionId === selectedId ? null : s.sectionId)}
                        >
                          <span className={styles.rankNo}>{i + 1}</span>
                          <span className={styles.rankLabel}>{s.section}</span>
                          <span className={styles.rankMeta}>
                            {s.avgTransmuted} avg &middot; {s.passPct}% passing
                            {s.atRiskCount > 0 ? ` · ${s.atRiskCount} at risk` : ""}
                          </span>
                        </button>
                        <div className={styles.barTrack}>
                          <div
                            className={styles.barFill}
                            style={{
                              width: `${Math.max(3, Math.min(100, w))}%`,
                              background: s.avgTransmuted < 75 ? "var(--destructive)" : "var(--primary)",
                            }}
                          />
                          <span className={styles.threshLine} style={{ left: `${refPos}%` }} />
                        </div>
                        <div className={styles.barFoot}>
                          <span className={styles.barValue}>{s.avgTransmuted}</span>
                          <span className={styles.barHint}>
                            {s.avgTransmuted >= 75 ? "≥75 · passing" : "below 75 · at risk"}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className={styles.panelFootnote}>Dashed line marks the 75 passing target.</p>
              </section>

              {/* Lollipop: subjects by failure count */}
              <section className={styles.panel}>
                <h3 className={styles.panelTitle}>Subjects by failure count</h3>
                <ul className={styles.lolliList} {...subjectLolliProps}>
                  {subjectRanking.slice(0, 8).map((subj, i) => {
                    const pos = maxSubjectCount > 0 ? (subj.count / maxSubjectCount) * 100 : 0;
                    return (
                      <li key={subj.subject} className={styles.lolliItem} data-tip-index={i}>
                        <span className={styles.lolliLabel}>{subj.subject}</span>
                        <div className={styles.lolliTrack}>
                          <span
                            className={styles.lolliDot}
                            style={{ left: `calc(${Math.max(0, Math.min(100, pos))}% - 7px)` }}
                          />
                        </div>
                        <span className={styles.lolliValue}>{subj.count}</span>
                      </li>
                    );
                  })}
                </ul>
                <ChartFloater tip={subjectLolliTip} />
                <div className={styles.chartNote}>
                  <p className={styles.chartNoteText}>
                    <strong className={styles.chartNoteLabel}>What it means · </strong>
                    {subjectInterpretation}
                  </p>
                </div>
              </section>

              {/* Dot plot: section pass rates on a 0-100 axis */}
              <section className={styles.panel}>
                <h3 className={styles.panelTitle}>Section pass rates</h3>
<ul className={styles.lolliList} {...passRateProps}>
                  {sectionRanking.map((s, i) => (
                    <li key={s.sectionId} className={styles.lolliItem} data-tip-index={i}>
                      <span className={styles.lolliLabel}>{s.section}</span>
                      <div className={styles.lolliTrack}>
                        <span className={styles.dotPlotTarget} />
                        <span
                          className={`${styles.lolliDot} ${s.passPct < 75 ? styles.lolliDotBelow : ""}`}
                          style={{ left: `calc(${Math.max(0, Math.min(100, s.passPct))}% - 7px)` }}
                        />
                      </div>
                      <span className={styles.lolliValue}>{s.passPct}%</span>
                    </li>
                  ))}
                </ul>
                <ChartFloater tip={passRateTip} />
                <div className={styles.chartNote}>
                  <p className={styles.chartNoteText}>
                    <strong className={styles.chartNoteLabel}>What it means · </strong>
                    {passRateInterpretation}
                  </p>
                </div>
              </section>

              {/* Stacked bars: composition per subject */}
              <section className={styles.panel}>
                <h3 className={styles.panelTitle}>Composition per subject</h3>
                <ChartContainer config={subjectStackConfig} className={styles.stackChart}>
                  <BarChart data={subjectComposition} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="subject" tickLine={false} axisLine={false} width={110} tickMargin={6} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="passed" stackId="a" fill="var(--primary)" />
                    <Bar dataKey="below" stackId="a" radius={[0, 3, 3, 0]} fill="var(--destructive)" />
                  </BarChart>
                </ChartContainer>
                <div className={styles.chartNote}>
                  <p className={styles.chartNoteText}>
                    <strong className={styles.chartNoteLabel}>What it means · </strong>
                    {subjectCompositionInterpretation}
                  </p>
                </div>
              </section>

              {/* Dumbbell: student-average spread per section */}
              <section className={styles.panel}>
                <h3 className={styles.panelTitle}>Student-average spread</h3>
<ul className={styles.dumbList} {...spreadProps}>
                  {sectionSpread.map((s, i) => (
                    <li key={s.section} className={styles.dumbItem} data-tip-index={i}>
                      <span className={styles.dumbLabel}>{s.section}</span>
                      <div className={styles.dumbTrack}>
                        <span
                          className={styles.dumbRange}
                          style={{ left: `${s.minPct}%`, width: `${Math.max(0.5, s.maxPct - s.minPct)}%` }}
                        />
                        <span
                          className={`${styles.dumbDot} ${s.min < 75 ? styles.dumbDotBelow : ""}`}
                          style={{ left: `calc(${s.minPct}% - 5px)` }}
                        />
                        <span
                          className={`${styles.dumbAvg} ${s.avg < 75 ? styles.dumbAvgBelow : ""}`}
                          style={{ left: `calc(${s.avgPct}% - 5px)` }}
                        />
                        <span className={styles.dumbDot} style={{ left: `calc(${s.maxPct}% - 5px)` }} />
                      </div>
                      <span className={styles.dumbValue}>{s.min}–{s.max}</span>
                    </li>
                  ))}
                </ul>
                <ChartFloater tip={spreadTip} />
                <div className={styles.chartNote}>
                  <p className={styles.chartNoteText}>
                    <strong className={styles.chartNoteLabel}>What it means · </strong>
                    {spreadInterpretation}
                  </p>
                </div>
              </section>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colLeft}>Student</th>
            <th>Average</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
