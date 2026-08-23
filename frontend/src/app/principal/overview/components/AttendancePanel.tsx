import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { TabLink } from "./TabLink";
import { ATTENDANCE_TREND, attendanceConfig, GRADE_ATTENDANCE } from "./data";
import styles from "./attendance-panel.module.css";

export function AttendancePanel({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <div className={styles.attendancePanel}>
      <div className={styles.attendanceChartCard}>
        <h3 className={styles.chartTitle}>Present Count · Last 5 School Days</h3>
        <ChartContainer
          id="attendance-trend"
          config={attendanceConfig}
          className={styles.lineWrap}
        >
          <RechartsLineChart
            data={ATTENDANCE_TREND}
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
        {GRADE_ATTENDANCE.map((g) => {
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
        })}
      </div>

      <TabLink href={href} label={label} />
    </div>
  );
}
