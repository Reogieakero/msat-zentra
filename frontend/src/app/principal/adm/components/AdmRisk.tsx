"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ClipboardList, HeartPulse, type LucideIcon } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { riskTone } from "@/lib/labels/status-tone";
import { useTerm } from "@/lib/term/TermContext";
import { fetchRiskBoard } from "@/services/principal/risk.service";
import { InsightCallout } from "@/components/ui/insight-callout";
import { GuidanceAdmNumberText } from "../../../guidance/adm/components/guidance-adm-number-text";
import { GuidanceAdmValuePill } from "../../../guidance/adm/components/guidance-adm-value-pill";
import { AMBER_STEPS } from "../../../guidance/adm/components/guidance-adm-palette";
import reportStyles from "../../../guidance/adm/components/guidance-adm-reports.module.css";
import styles from "../../../guidance/adm/components/guidance-adm.module.css";

const LEVEL_COLORS = [AMBER_STEPS[0], AMBER_STEPS[1], AMBER_STEPS[2]];

/**
 * Shared card shell for every AdmRisk chart tooltip — same shape, border and
 * type as the "Students by risk level" tooltip, so hovering any chart on the
 * ADM desk reads the same. Callers pass a title and the figure line.
 */
function TooltipShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-card-foreground shadow-lg">
      <p className="font-semibold">{title}</p>
      <div className="mt-1 text-muted-foreground">{children}</div>
    </div>
  );
}

function Figure({ count, noun, pct }: { count: number; noun: string; pct: number }) {
  return (
    <>
      <span className="font-semibold text-foreground">{count}</span>{" "}
      {count === 1 ? noun : `${noun}s`} ·{" "}
      <span className="font-semibold text-amber-600 dark:text-amber-400">{pct}%</span>
    </>
  );
}

function LevelTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { level: string; count: number } }>;
  total: number;
}) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
  return (
    <TooltipShell title={`${row.level} risk`}>
      <Figure count={row.count} noun="student" pct={pct} />
    </TooltipShell>
  );
}

type FactorRow = { key: string; label: string; count: number };

function FactorTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload?: FactorRow }>;
  total: number;
}) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
  return (
    <TooltipShell title={row.label}>
      <Figure count={row.count} noun="flag" pct={pct} />
    </TooltipShell>
  );
}

function BoardIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="text-primary" aria-hidden>
      <Icon size={14} />
    </span>
  );
}

function joinParts(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  const [last, ...rest] = parts.slice().reverse();
  return `${rest.reverse().join(", ")} and ${last}`;
}

export function AdmRisk() {
  const { activeTerm, termReady } = useTerm();
  const { data, isPending } = useQuery({
    queryKey: [
      "risk-board",
      "adm",
      activeTerm?.termId ?? null,
      activeTerm?.schoolYearId ?? null,
    ],
    queryFn: () => fetchRiskBoard({ admOnly: true }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: termReady,
  });

  if (isPending || !data) {
    return (
      <div className={styles.insightsGrid} aria-busy="true" aria-label="Loading ADM risk">
        {[0, 1].map((i) => (
          <KanbanBoard key={i} title={<Skeleton className="h-4 w-1/2" />}>
            <Skeleton className="h-40 w-full" />
          </KanbanBoard>
        ))}
      </div>
    );
  }

  const levels = data.levelDistribution;
  const totalStudents = levels.reduce((sum, l) => sum + l.count, 0);
  const high = levels.find((l) => l.level === "High")?.count ?? 0;
  const moderate = levels.find((l) => l.level === "Moderate")?.count ?? 0;

  const factors = [
    { key: "Academic", label: "Academic", count: data.factorTotals.Academic },
    { key: "Attendance", label: "Attendance", count: data.factorTotals.Attendance },
    { key: "Behavioral", label: "Behavioral", count: data.factorTotals.Behavioral },
  ];
  const factorTotal = factors.reduce((sum, f) => sum + f.count, 0);

  const parts: string[] = [];
  if (high > 0) parts.push(`${high} high risk`);
  if (moderate > 0) parts.push(`${moderate} moderate`);
  const levelSummary =
    totalStudents === 0
      ? "Risk levels will appear here once students are assessed."
      : parts.length > 0
        ? `${joinParts(parts)} out of ${totalStudents} assessed student${totalStudents === 1 ? "" : "s"}.`
        : `All ${totalStudents} assessed student${totalStudents === 1 ? "" : "s"} are low risk.`;

  const topFactor = [...factors].sort((a, b) => b.count - a.count)[0];

  return (
    <>
      <div className={styles.insightsGrid}>
        <KanbanBoard
          title="Students by risk level"
          icon={<BoardIcon icon={HeartPulse} />}
          description="Live risk levels for learners with an ADM case."
          className="flex-1"
          footer={
            <div className="mt-auto">
              <InsightCallout>
                <GuidanceAdmNumberText>{levelSummary}</GuidanceAdmNumberText>
              </InsightCallout>
            </div>
          }
        >
          {totalStudents === 0 ? (
            <p className={reportStyles.empty}>No assessed students yet.</p>
          ) : (
            <div className={reportStyles.split}>
              <div className={reportStyles.donutWrap}>
                <ResponsiveContainer width="100%" height={168}>
                  <PieChart>
                    <Pie
                      data={levels.filter((l) => l.count > 0)}
                      dataKey="count"
                      nameKey="level"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {levels.map((l, i) => (
                        <Cell key={l.level} fill={LEVEL_COLORS[i % LEVEL_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      cursor={false}
                      content={<LevelTooltip total={totalStudents} />}
                      wrapperStyle={{ zIndex: 60 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className={reportStyles.donutCenter}>
                  <span className={reportStyles.donutValue}>{totalStudents}</span>
                  <span className={reportStyles.donutCaption}>students</span>
                </div>
              </div>
              <ul className={reportStyles.legend}>
                {levels.map((l, i) => (
                  <li key={l.level} className={reportStyles.legendItem}>
                    <Pill tone={riskTone(l.level)} label="Risk level">
                      <span
                        className={reportStyles.legendDot}
                        style={{ backgroundColor: LEVEL_COLORS[i % LEVEL_COLORS.length] }}
                        aria-hidden
                      />
                      {l.level}
                    </Pill>
                    <span className={reportStyles.legendCount}>
                      <GuidanceAdmValuePill
                        count={l.count}
                        percent={
                          totalStudents > 0 ? Math.round((l.count / totalStudents) * 100) : 0
                        }
                        label={`${l.level} risk students and their share of assessed students`}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </KanbanBoard>

        <KanbanBoard
          title="Risk cases by category"
          icon={<BoardIcon icon={ClipboardList} />}
          description="What the risk flags on ADM cases are about."
          className="flex-1"
          footer={
            <div className="mt-auto">
              <InsightCallout>
                <GuidanceAdmNumberText>
                  {factorTotal === 0
                    ? "Risk factors will appear once flags are raised."
                    : `${topFactor.label} concerns lead with ${topFactor.count} of ${factorTotal} flags — target that driver first.`}
                </GuidanceAdmNumberText>
              </InsightCallout>
            </div>
          }
        >
          {factorTotal === 0 ? (
            <p className={reportStyles.empty}>No risk factors recorded yet.</p>
          ) : (
            <div className={reportStyles.barChart}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={factors}
                  layout="vertical"
                  margin={{ top: 2, right: 28, bottom: 2, left: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={88}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    cursor={false}
                    content={<FactorTooltip total={factorTotal} />}
                    wrapperStyle={{ zIndex: 60 }}
                  />
                  <Bar dataKey="count" name="Flags" barSize={12} radius={[2, 4, 4, 2]}>
                    {factors.map((f, i) => (
                      <Cell key={f.key} fill={AMBER_STEPS[i % AMBER_STEPS.length]} />
                    ))}
                    <LabelList
                      dataKey="count"
                      position="right"
                      fontSize={10}
                      fontWeight={600}
                      fill={AMBER_STEPS[0]}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </KanbanBoard>
      </div>
    </>
  );
}
