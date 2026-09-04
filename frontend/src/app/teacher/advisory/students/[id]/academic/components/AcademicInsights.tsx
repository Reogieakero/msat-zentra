"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquareText } from "lucide-react";
import type { AcademicGrade, AcademicSummary, GradeVersion } from "./academic-data";
import styles from "./AcademicInsights.module.css";

const PASS_MARK = 75;

interface AcademicInsightsProps {
  grades: AcademicGrade[];
  summary: AcademicSummary | null;
  version: GradeVersion;
  loading: boolean;
}

function versionValue(g: AcademicGrade, version: GradeVersion): number | null {
  return version === "computed" ? g.computedAverage : g.transmutedGrade;
}

function buildInterpretation(
  grades: AcademicGrade[],
  summary: AcademicSummary,
  version: GradeVersion
): string[] {
  const lines: string[] = [];
  const values = grades
    .map((g) => versionValue(g, version))
    .filter((v): v is number => v !== null);

  if (values.length === 0) {
    return ["No graded subjects yet — nothing to interpret so far."];
  }

  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const noun = version === "computed" ? "computed average" : "final grade";
  lines.push(
    `${avg.toFixed(1)} ${noun} across ${values.length} graded subject${values.length === 1 ? "" : "s"}.`
  );

  const ranked = grades
    .filter((g) => versionValue(g, version) !== null)
    .sort((a, b) => (versionValue(a, version) ?? 0) - (versionValue(b, version) ?? 0));
  const weakest = ranked[0];
  const strongest = ranked[ranked.length - 1];
  if (ranked.length > 1) {
    lines.push(
      `Strongest: ${strongest.subject} (${versionValue(strongest, version)}) · Weakest: ${weakest.subject} (${versionValue(weakest, version)}).`
    );
  }

  if (summary.failed > 0) {
    const failing = grades
      .filter((g) => (g.remarks ?? "") === "Failed")
      .map((g) => `${g.subject} (${versionValue(g, version) ?? "—"})`)
      .join(", ");
    lines.push(`${summary.failed} failing — ${failing}. Needs intervention.`);
  } else {
    lines.push(`All ${summary.passed} graded subject${summary.passed === 1 ? "" : "s"} passed.`);
  }

  const locked = grades.filter((g) => g.lockStatus !== null && g.lockStatus !== "unlocked").length;
  if (grades.length > 0) {
    lines.push(`${locked} of ${grades.length} grades locked for this term.`);
  }

  return lines;
}

export function AcademicInsights({ grades, summary, version, loading }: AcademicInsightsProps) {
  const chartData = useMemo(
    () =>
      grades
        .filter((g) => versionValue(g, version) !== null)
        .map((g) => ({
          subject: g.subject.replace(" 7", "").replace(" 8", "").replace(" 9", ""),
          fullSubject: g.subject,
          average: versionValue(g, version) as number,
          passed: (g.remarks ?? "") === "Passed",
        })),
    [grades, version]
  );

  const lines = useMemo(
    () => (summary ? buildInterpretation(grades, summary, version) : []),
    [grades, summary, version]
  );
  const verdict =
    summary && summary.graded > 0
      ? summary.failed > 0
        ? { text: `Needs attention — ${summary.failed} subject${summary.failed === 1 ? "" : "s"} failing.`, bad: true }
        : { text: "On track — all graded subjects passed.", bad: false }
      : null;

  if (loading || !summary) {
    return (
      <div className={styles.panel} aria-busy="true" aria-label="Loading academic insights">
        <Skeleton className={styles.skelChart} />
        <div className={styles.skelMessage}>
          <Skeleton className={styles.skelLine} />
          <Skeleton className={styles.skelLine} />
          <Skeleton className={styles.skelLineShort} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.chartCol}>
        {chartData.length === 0 ? (
          <p className={styles.noChart}>No graded subjects to chart yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, chartData.length * 52)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis
                type="category"
                dataKey="subject"
                width={88}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />
              <ReferenceLine
                x={PASS_MARK}
                stroke="var(--destructive)"
                strokeDasharray="4 4"
                label={{ value: "75", fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Bar dataKey="average" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive animationDuration={900}>
                {chartData.map((d) => (
                  <Cell
                    key={d.fullSubject}
                    fill={d.passed ? "var(--success, #16a34a)" : "var(--destructive)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        <p className={styles.chartHint}>Dashed line marks the 75 passing grade.</p>
      </div>

      <div className={styles.messageCol}>
        <p className={styles.messageHead}>
          <MessageSquareText className={styles.messageIcon} aria-hidden />
          What this means
        </p>
        <ul className={styles.messageList}>
          {lines.map((line, i) => (
            <li key={i} className={styles.messageLine}>
              {line}
            </li>
          ))}
        </ul>
        {verdict ? (
          <Badge
            variant={verdict.bad ? "destructive" : "success"}
            className={styles.verdictBadge}
          >
            {verdict.text}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
