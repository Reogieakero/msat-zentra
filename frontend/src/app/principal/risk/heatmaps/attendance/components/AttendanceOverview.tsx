"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  TriangleAlert,
  X,
  Users,
  Gauge,
  ShieldAlert,
  CalendarDays,
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { SectionAttendanceStat, TrendPoint } from "../../components/types";
import styles from "./AttendanceOverview.module.css";

type Session = "AM" | "PM";

interface SectionStudent {
  id: string;
  lrn: string;
  name: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  rate: number;
}

interface Kpi {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  suffix?: string;
  tone: "default" | "good" | "warn";
}

const chartConfig = {
  rate: { label: "Attendance %", color: "#2563eb" },
} satisfies ChartConfig;

export function AttendanceOverview({
  session,
  selectedSectionId,
  onClearSection,
}: {
  session: Session;
  selectedSectionId?: string | null;
  onClearSection?: () => void;
}) {
  const isDrillDown = Boolean(selectedSectionId);

  const statsQuery = useQuery({
    queryKey: ["attendance-section-stats", session, selectedSectionId ?? "none"],
    queryFn: async () => {
      const params: Record<string, string> = { session };
      if (selectedSectionId) params.sectionId = selectedSectionId;
      const res = await apiClient.get<{
        sections: SectionAttendanceStat[];
        trend: TrendPoint[];
        schoolDays: number;
      }>("/api/attendance/section-stats", { params });
      return res.data;
    },
  });

  const studentsQuery = useQuery({
    queryKey: ["attendance-section-students", session, selectedSectionId],
    queryFn: async () => {
      const res = await apiClient.get<{
        section: string;
        schoolDays: number;
        students: SectionStudent[];
      }>(`/api/attendance/sections/${selectedSectionId}/students`, {
        params: { session },
      });
      return res.data;
    },
    enabled: isDrillDown,
  });

  const isLoading = statsQuery.isPending || (isDrillDown && studentsQuery.isPending);

  const stats = React.useMemo(() => statsQuery.data?.sections ?? [], [statsQuery.data]);
  const trend = React.useMemo(() => statsQuery.data?.trend ?? [], [statsQuery.data]);
  const schoolDays = isDrillDown
    ? (studentsQuery.data?.schoolDays ?? 0)
    : (statsQuery.data?.schoolDays ?? 0);

  const students = React.useMemo(
    () => studentsQuery.data?.students ?? [],
    [studentsQuery.data]
  );
  const sectionLabel = studentsQuery.data?.section ?? "";
  const isStudentsError =
    isDrillDown &&
    studentsQuery.isError &&
    !studentsQuery.isPending &&
    students.length === 0;

  const sorted = React.useMemo(
    () => [...stats].sort((a, b) => a.rate - b.rate),
    [stats]
  );
  const alerts = React.useMemo(
    () => stats.filter((s) => s.rate < 80).sort((a, b) => a.rate - b.rate),
    [stats]
  );
  const maxBelow = Math.max(1, ...stats.map((s) => s.belowDays));

  const studentAlerts = React.useMemo(
    () => students.filter((s) => s.rate < 80).sort((a, b) => a.rate - b.rate),
    [students]
  );

  // Dashboard KPI values — switch between section-level and per-student when
  // drilling down into a single section.
  const kpis: Kpi[] = isDrillDown
    ? [
        {
          icon: Users,
          label: "Students",
          value: String(students.length),
          tone: "default",
        },
        {
          icon: Gauge,
          label: "Avg attendance",
          value: students.length
            ? (students.reduce((s, x) => s + x.rate, 0) / students.length).toFixed(0)
            : "0",
          suffix: "%",
          tone: "default",
        },
        {
          icon: ShieldAlert,
          label: "Below 80%",
          value: String(studentAlerts.length),
          tone: studentAlerts.length > 0 ? "warn" : "good",
        },
        {
          icon: CalendarDays,
          label: "School days",
          value: String(schoolDays),
          tone: "default",
        },
      ]
    : [
        {
          icon: Users,
          label: "Total enrolled",
          value: stats.reduce((s, x) => s + x.enrolled, 0).toLocaleString(),
          tone: "default",
        },
        {
          icon: Gauge,
          label: "Avg attendance",
          value: stats.length
            ? (stats.reduce((s, x) => s + x.rate, 0) / stats.length).toFixed(0)
            : "0",
          suffix: "%",
          tone: "default",
        },
        {
          icon: ShieldAlert,
          label: "Sections below 80%",
          value: String(alerts.length),
          tone: alerts.length > 0 ? "warn" : "good",
        },
        {
          icon: CalendarDays,
          label: "School days",
          value: String(schoolDays),
          tone: "default",
        },
      ];

  return (
    <div className={styles.stack}>
      {/* Card 1 — table */}
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <CardTitle>
              {isDrillDown
                ? `Section attendance · ${sectionLabel}`
                : "Section attendance breakdown"}
            </CardTitle>
            <CardDescription>
              {isDrillDown
                ? `Per-student breakdown in ${sectionLabel}.`
                : "Averages and days below 80% across sections."}
            </CardDescription>
          </div>
          {isDrillDown ? (
            <CardAction>
              <Button variant="ghost" size="sm" onClick={() => onClearSection?.()}>
                <X aria-hidden />
                Clear
              </Button>
            </CardAction>
          ) : (
            <CardAction className={styles.sessionChip}>
              <Badge variant="secondary">{session} session</Badge>
            </CardAction>
          )}
        </CardHeader>

        <CardContent className={styles.content}>
          <div className={styles.kpiGrid}>
            {kpis.map((k) => (
              <div key={k.label} className={styles.kpiCard}>
                <div className={`${styles.kpiIcon} ${styles[`tone_${k.tone}`]}`}>
                  <k.icon className={styles.kpiIconSvg} aria-hidden />
                </div>
                <div className={styles.kpiBody}>
                  {isLoading ? (
                    <Skeleton className={styles.kpiValueSkel} />
                  ) : (
                    <span className={styles.kpiValue}>
                      {k.value}
                      {k.suffix ? <span className={styles.kpiSuffix}>{k.suffix}</span> : null}
                    </span>
                  )}
                  <span className={styles.kpiLabel}>{k.label}</span>
                </div>
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className={styles.tableSkel}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className={styles.tableSkelRow} />
              ))}
            </div>
          ) : isDrillDown ? (
            isStudentsError ? (
              <p className={styles.empty}>Could not load the students in this section.</p>
            ) : students.length === 0 ? (
              <p className={styles.empty}>No students in this section.</p>
            ) : (
              <Table
                headers={["Student", "LRN", "Pres", "Late", "Abs", "Exc", "Rate"]}
              >
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className={styles.colLeft}>{s.name}</td>
                    <td className={`${styles.mono} ${styles.lrn}`}>{s.lrn}</td>
                    <td className={styles.mono}>{s.present}</td>
                    <td className={styles.mono}>{s.late}</td>
                    <td className={styles.mono}>{s.absent}</td>
                    <td className={styles.mono}>{s.excused}</td>
                    <td>
                      <Badge
                        variant={s.rate < 80 ? "destructive" : "outline"}
                        className={styles.rateBadge}
                      >
                        {s.rate}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </Table>
            )
          ) : (
            <Table
              headers={[
                "Section",
                "Enrolled",
                "Attendance %",
                "Below 80%",
                "Trend",
              ]}
            >
              {sorted.map((s) => (
                <tr key={s.sectionId}>
                  <td className={styles.colLeft}>
                    <span className={styles.sectionCell}>
                      <span className={styles.sectionName}>{s.section}</span>
                      <span className={styles.sectionGrade}>Grade {s.gradeLevel}</span>
                    </span>
                  </td>
                  <td className={styles.mono}>{s.enrolled}</td>
                  <td>
                    <span className={styles.rate} data-low={s.rate < 80}>
                      {s.rate}
                      <span className={styles.rateSub}>%</span>
                    </span>
                  </td>
                  <td>
                    <span className={styles.belowTrack}>
                      <span
                        className={styles.belowFill}
                        style={{ width: `${(s.belowDays / maxBelow) * 100}%` }}
                      />
                    </span>
                    <span className={styles.belowNum}>{s.belowDays}</span>
                  </td>
                  <td>
                    <TrendIcon trend={s.trend} />
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Card 2 — trend chart */}
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <CardTitle>
              {isDrillDown
                ? `Attendance trend · ${sectionLabel}`
                : "Attendance trend (school-wide)"}
            </CardTitle>
            <CardDescription>
              Daily present percentage of the enrollable headcount for the {session} session.
            </CardDescription>
          </div>
          <CardAction>
            <Badge variant="secondary">{session} session</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className={styles.content}>
          {isLoading ? (
            <Skeleton className={styles.chartSkel} />
          ) : (
            <ChartContainer config={chartConfig} className={styles.chart}>
              <AreaChart
                data={trend}
                margin={{ top: 8, right: 8, bottom: 0, left: -6 }}
              >
                <defs>
                  <linearGradient id="attTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={28}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <ChartTooltip
                  content={<ChartTooltipContent formatter={(v) => `${v}%`} />}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fill="url(#attTrend)"
                  dot={false}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Card 3 — needs attention */}
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <CardTitle className={styles.attentionTitle}>
              <TriangleAlert className={styles.attentionIcon} aria-hidden />
              Needs attention
            </CardTitle>
            <CardDescription>
              {isDrillDown
                ? "Students in this section below the 80% mark."
                : "Sections running below the 80% mark."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className={styles.content}>
          {isLoading ? (
            <div className={styles.alertSkel}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className={styles.alertSkelRow} />
              ))}
            </div>
          ) : isDrillDown ? (
            studentAlerts.length === 0 ? (
              <p className={styles.alertEmpty}>All students above 80%.</p>
            ) : (
              <ul className={styles.alertList}>
                {studentAlerts.slice(0, 6).map((s) => (
                  <li key={s.id} className={styles.alertItem}>
                    <span className={styles.alertName}>{s.name}</span>
                    <Badge variant="destructive" className={styles.alertRate}>
                      {s.rate}%
                    </Badge>
                  </li>
                ))}
              </ul>
            )
          ) : alerts.length === 0 ? (
            <p className={styles.alertEmpty}>All sections above 80%.</p>
          ) : (
            <ul className={styles.alertList}>
              {alerts.slice(0, 6).map((s) => (
                <li key={s.sectionId} className={styles.alertItem}>
                  <span className={styles.alertName}>{s.section}</span>
                  <Badge variant="destructive" className={styles.alertRate}>
                    {s.rate}%
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <p className={styles.schoolDays}>
            <CalendarDays className={styles.schoolDaysIcon} aria-hidden />
            {schoolDays} school days &middot; term start → today
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Table({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={h} className={i === 0 ? styles.colLeft : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function TrendIcon({ trend }: { trend: SectionAttendanceStat["trend"] }) {
  if (trend === "up")
    return <ArrowUpRight size={15} className={styles.trendUp} aria-label="improving" />;
  if (trend === "down")
    return <ArrowDownRight size={15} className={styles.trendDown} aria-label="declining" />;
  return <Minus size={15} className={styles.trendFlat} aria-label="steady" />;
}
