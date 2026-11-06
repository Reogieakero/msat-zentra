"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";
import {
  fetchRecordKeeperOverview,
  fetchRegistrarOverview,
  type RegistryDesk,
} from "@/services/registry/overview.service";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./OverviewGradeChart.module.css";

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
  boxShadow: "0 4px 12px -6px rgb(0 0 0 / 0.25)",
};

const TOTAL_COLOR = "var(--primary)";
// Amber — the record-keeper chart accent (bars + legend dot), matching the
// folder accent used across the kanban cards.
const ROSTER_COLOR = "#f59e0b";

interface BreakdownGroup {
  id: string;
  label: string;
  grade: string;
  withAccount: number;
  pending: number;
  noAccount?: number;
  total?: number;
}

interface GradeRow {
  grade: string;
  label: string;
  total: number;
}

function fetchBreakdown(desk: RegistryDesk): Promise<{ data: BreakdownGroup[] }> {
  return apiClient
    .get<{ data: BreakdownGroup[] }>(`/api/${desk}/account-breakdown`)

    .then((res) => ({ data: Array.isArray(res.data?.data) ? res.data.data : [] }));
}

function formatGrade(grade: string) {
  return grade.startsWith("G") ? `Grade ${grade.slice(1)}` : grade;
}

export function OverviewGradeChart({
  desk,
  variant = "glow",
}: {
  desk: RegistryDesk;
  /**
   * "glow" (default) — legacy registry glow card (account-status breakdown).
   * "kanban" — kanban shell (record keeper); per-grade student roster counts.
   */
  variant?: "glow" | "kanban";
}) {
  const kanban = variant === "kanban";

  const breakdownQuery = useQuery({
    queryKey:
      desk === "registrar"
        ? ["registrar-account-breakdown"]
        : ["record-keeper-overview-breakdown"],
    queryFn: () => fetchBreakdown(desk),
    staleTime: 30_000,
    // The kanban variant charts roster counts from the overview query below.
    enabled: !kanban,
  });

  const overviewQuery = useQuery({
    queryKey: [`${desk}-overview`],
    queryFn: desk === "registrar" ? fetchRegistrarOverview : fetchRecordKeeperOverview,
    staleTime: 30_000,
    enabled: kanban,
  });

  const rows: GradeRow[] = React.useMemo(() => {
    if (kanban) {
      // Roster counts (enlisted learners per grade) — every learner on the
      // class list, account or not. Band order is already ascending.
      return (overviewQuery.data?.rosterByGrade ?? []).map((r) => ({
        grade: r.grade,
        label: r.grade,
        total: r.count,
      }));
    }
    const raw = breakdownQuery.data?.data;
    const list = Array.isArray(raw) ? raw : [];
    const map = new Map<string, GradeRow>();
    const groupTotal = (g: BreakdownGroup) =>
      g.total ?? g.withAccount + g.pending + (g.noAccount ?? 0);
    for (const g of list) {
      const existing = map.get(g.grade);
      if (existing) {
        existing.total += groupTotal(g);
      } else {
        map.set(g.grade, {
          grade: g.grade,
          label: formatGrade(g.grade),
          total: groupTotal(g),
        });
      }
    }
    return [...map.values()].sort((a, b) => a.grade.localeCompare(b.grade));
  }, [kanban, overviewQuery.data, breakdownQuery.data]);

  const isPending = kanban ? overviewQuery.isPending : breakdownQuery.isPending;
  const isError = kanban ? overviewQuery.isError : breakdownQuery.isError;
  const population = rows.reduce((s, r) => s + r.total, 0);
  const isEmpty = !isPending && !isError && rows.length === 0;
  const barColor = kanban ? ROSTER_COLOR : TOTAL_COLOR;

  const body = isPending ? (
    <Skeleton className={styles.skel} />
  ) : isError ? (
    <p className={styles.empty}>Could not load grade counts.</p>
  ) : rows.length === 0 ? (
    <div className={styles.emptyBlock}>
      <span className={styles.emptyIcon} aria-hidden>
        <BarChart3 />
      </span>
      <p className={styles.emptyTitle}>No enrollments yet</p>
      <p className={styles.emptyHint}>
        Grade-level counts appear once students are enrolled.
      </p>
    </div>
  ) : (
    <>
      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height="100%">
          {kanban ? (
            /* Horizontal bars — grade labels read down the left edge. */
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
              barCategoryGap="30%"
            >
              <XAxis
                type="number"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                type="category"
                dataKey="label"
                /* Force every grade label — recharts otherwise hides/wraps
                   ticks and the labels stop lining up with their bars. */
                interval={0}
                tickLine={false}
                axisLine={false}
                width={80}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                cursor={{
                  fill: "color-mix(in oklch, var(--foreground), transparent 95%)",
                }}
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar
                dataKey="total"
                name="Students"
                radius={[0, 6, 6, 0]}
                fill={barColor}
                maxBarSize={18}
                animationDuration={600}
                animationEasing="ease-out"
              />
            </BarChart>
          ) : (
            <BarChart
              data={rows}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              barCategoryGap="28%"
            >
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={32}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                cursor={{
                  fill: "color-mix(in oklch, var(--foreground), transparent 95%)",
                }}
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar
                dataKey="total"
                name="Students"
                radius={[6, 6, 0, 0]}
                fill={barColor}
                maxBarSize={56}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <ul className={styles.legend}>
        <li className={styles.legendItem}>
          <span
            className={styles.dot}
            style={{ backgroundColor: barColor }}
            aria-hidden
          />
          <span className={styles.legendLabel}>Students</span>
          <span className={styles.legendCount}>{population}</span>
        </li>
      </ul>
    </>
  );

  if (kanban) {
    return (
      <KanbanBoard
        className="flex-1"
        title="Students per Grade Level"
        icon={
          <span className="text-amber-500" aria-hidden>
            <BarChart3 size={14} />
          </span>
        }
        count={isPending ? undefined : isError ? "—" : population}
        description="Grade-level student roster — every enlisted learner, account or not."
      >
        <div className={styles.kanbanBody}>{body}</div>
      </KanbanBoard>
    );
  }

  return (
    <section className={assign.card} aria-labelledby={isEmpty ? undefined : "overview-students-grade"}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      {!isEmpty && (
        <div className={`${styles.header} relative`}>
          <div className={styles.headerText}>
            <h2 id="overview-students-grade" className="text-base font-semibold">Students per Grade Level</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Current advisory population per grade — class lists accumulated, not
              account status.
            </p>
          </div>
        </div>
      )}
      <div className={`${styles.content} relative`}>{body}</div>
    </section>
  );
}
