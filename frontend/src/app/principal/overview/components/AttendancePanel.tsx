import * as React from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, Sun, Moon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type AttendanceSummary,
  type GradeAttendance,
} from "./data";
import { apiClient } from "@/lib/api/client";
import styles from "./attendance-panel.module.css";

const EMPTY: AttendanceSummary = { trend: [], grades: [] };

const chartConfig = {
  present: { label: "Present", color: "var(--primary)" },
} satisfies ChartConfig;

export function AttendancePanel({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const [summary, setSummary] = React.useState<AttendanceSummary>(EMPTY);
  const [loading, setLoading] = React.useState(true);
  const [session, setSession] = React.useState<"ALL" | "AM" | "PM">("ALL");
  const [selectedGrade, setSelectedGrade] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .get<AttendanceSummary>("/api/attendance/summary", {
        params: session === "ALL" ? {} : { session },
      })
      .then((res) => {
        if (!cancelled) setSummary(res.data);
      })
      .catch((err: unknown) => {
        console.error("[/api/attendance/summary] fetch failed:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (loading) {
    return (
      <div className={styles.attendancePanel}>
        <div className={styles.attendanceChartCard}>
          <Skeleton className={styles.chartTitleSkeleton} />
          <Skeleton className={styles.lineWrapSkeleton} />
        </div>
        <div className={styles.gradeGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.gradeCard}>
              <Skeleton className={styles.gradeHeadSkeleton} />
              <Skeleton className={styles.gradeMetricSkeleton} />
              <Skeleton className={styles.gradeBarSkeleton} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const trend = summary.trend;
  const grades = summary.grades as GradeAttendance[];

  const dayLabel = (idxFromEnd: number) =>
    trend.length - 1 - idxFromEnd >= 0
      ? trend[trend.length - 1 - idxFromEnd].day
      : null;
  const todayLabel = dayLabel(0);
  const yesterdayLabel = dayLabel(1);

  return (
    <div className={styles.attendancePanel}>
      <div className={styles.filterBar}>
        <Tabs value={session} onValueChange={(v) => { setSession(v as "ALL" | "AM" | "PM"); setLoading(true); }}>
          <TabsList variant="line" className={styles.sessionTabs}>
            <TabsTrigger value="ALL" className={styles.sessionTab}>
              <LayoutGrid aria-hidden />
              All
            </TabsTrigger>
            <TabsTrigger value="AM" className={styles.sessionTab}>
              <Sun aria-hidden />
              AM
            </TabsTrigger>
            <TabsTrigger value="PM" className={styles.sessionTab}>
              <Moon aria-hidden />
              PM
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button asChild variant="default" size="sm" className={styles.openButton}>
          <a href={href}>Open {label}</a>
        </Button>
      </div>
      <div className={styles.attendanceChartCard}>
        <h3 className={styles.chartTitle}>Total Present · Last 5 School Days{session !== "ALL" ? ` · ${session}` : ""}</h3>
        <ChartContainer
          id="attendance-trend"
          config={chartConfig}
          className={styles.lineWrap}
        >
          <RechartsLineChart
            data={trend}
            margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
          >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="color-mix(in oklch, var(--primary), transparent 85%)" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
                stroke="var(--primary)"
                tick={{ fill: "var(--primary)" }}
              />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={40} stroke="var(--primary)" tick={{ fill: "var(--primary)" }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="present"
              type="monotone"
              stroke="var(--color-present)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </RechartsLineChart>
        </ChartContainer>
      </div>

      <div className={styles.gradeGrid}>
        {grades.length === 0 ? (
          <p className={styles.empty}>No attendance records yet</p>
        ) : (
          grades.map((g) => {
            const latest = g.days[g.days.length - 1];
            const prev = g.days[g.days.length - 2];
            const rate = latest && latest.total > 0
              ? Math.round((latest.present / latest.total) * 100)
              : 0;
            return (
              <button
                type="button"
                key={g.grade}
                onClick={() =>
                  setSelectedGrade((cur) => (cur === g.grade ? null : g.grade))
                }
                className={`${styles.gradeCard} ${
                  selectedGrade === g.grade ? styles.gradeCardSelected : ""
                }`}
              >
                <div className={styles.gradeHead}>
                  <span className={styles.gradeName}>{g.grade}</span>
                  <span className={styles.gradeRate}>{rate}%</span>
                </div>
                <div className={styles.gradeMetric}>
                  <span className={styles.gradePresent}>
                    {latest ? latest.present : 0}
                  </span>
                  <span className={styles.gradeTotal}>
                    present {todayLabel ? `· ${todayLabel}` : ""}
                  </span>
                </div>
                {prev ? (
                  <div className={styles.gradeDays}>
                    <span>{yesterdayLabel}</span>
                    <span className={styles.gradeDaysPrev}>{prev.present}</span>
                  </div>
                ) : (
                  <div className={styles.gradeDays}>
                    <span>Term</span>
                    <span className={styles.gradeDaysPrev}>{g.present}</span>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
