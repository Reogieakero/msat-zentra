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
import { TabLink } from "./TabLink";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type AttendanceSummary,
  type GradeAttendance,
} from "./data";
import { apiClient } from "@/lib/api/client";
import styles from "./attendance-panel.module.css";

const EMPTY: AttendanceSummary = { trend: [], grades: [] };

const chartConfig = {
  present: { label: "Present", color: "#166534" },
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

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .get<AttendanceSummary>("/api/attendance/summary")
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
  }, []);

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
        <Skeleton className={styles.tabLinkSkeleton} />
      </div>
    );
  }

  const trend = summary.trend;
  const grades = summary.grades as GradeAttendance[];

  return (
    <div className={styles.attendancePanel}>
      <div className={styles.attendanceChartCard}>
        <h3 className={styles.chartTitle}>Present Count · Last 5 School Days</h3>
        <ChartContainer
          id="attendance-trend"
          config={chartConfig}
          className={styles.lineWrap}
        >
          <RechartsLineChart
            data={trend}
            margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
            />
            <YAxis tickLine={false} axisLine={false} fontSize={12} width={40} />
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
            const rate = Math.round((g.present / g.total) * 100);
            return (
              <div key={g.grade} className={styles.gradeCard}>
                <div className={styles.gradeHead}>
                  <span className={styles.gradeName}>{g.grade}</span>
                  <span className={styles.gradeRate}>{rate}%</span>
                </div>
                <div className={styles.gradeMetric}>
                  <span className={styles.gradePresent}>{g.present}</span>
                  <span className={styles.gradeTotal}>/ {g.total} present</span>
                </div>
                <div className={styles.gradeBar}>
                  <span
                    className={styles.gradeBarFill}
                    style={{ width: `${rate}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      <TabLink href={href} label={label} />
    </div>
  );
}
