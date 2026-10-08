import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import styles from "./reports-panels.module.css";
export const CHART_CONFIG = {
  avgTransmuted: { label: "Avg Transmuted" },
  candidates: { label: "Candidates" },
  count: { label: "Cases" },
  rate: { label: "Attendance %" },
  referred: { label: "Referred" },
  resolved: { label: "Resolved" },
  ongoing: { label: "Ongoing" },
  unresolved: { label: "Unresolved" },
} as const;
export function MiniLine({ data }: { data: { term: string; avgTransmuted: number }[] }) {
  return (
    <ChartContainer config={CHART_CONFIG} className={styles.chartMini}>
      <LineChart data={data}>
        <XAxis dataKey="term" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis domain={[70, 90]} tickLine={false} axisLine={false} fontSize={11} hide />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          type="monotone"
          dataKey="avgTransmuted"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={{ r: 2.5 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
export function MiniBar({
  data,
  dataKey,
  labelKey,
  height = 150,
  hideLabels = false,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  labelKey: string;
  height?: number;
  hideLabels?: boolean;
}) {
  const horizontal = labelKey !== "grade" && labelKey !== "section" && labelKey !== "action" && labelKey !== "category";
  return (
    <ChartContainer config={CHART_CONFIG} className={styles.chartMini} style={{ height }}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"}>
        <XAxis
          type={horizontal ? "number" : "category"}
          dataKey={horizontal ? undefined : labelKey}
          tickLine={false}
          axisLine={false}
          fontSize={10}
        />
        <YAxis
          type={horizontal ? "category" : "number"}
          dataKey={horizontal ? labelKey : undefined}
          tickLine={false}
          axisLine={false}
          fontSize={10}
          width={horizontal ? 84 : undefined}
          height={horizontal ? undefined : 8}
          hide={horizontal ? hideLabels : undefined}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar
          dataKey={dataKey}
          fill="var(--primary)"
          radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          barSize={horizontal ? 12 : 14}
        />
      </BarChart>
    </ChartContainer>
  );
}
export function StackedMini({
  data,
}: {
  data: { grade: string; referred: number; resolved: number; ongoing: number; unresolved: number }[];
}) {
  return (
    <ChartContainer config={CHART_CONFIG} className={styles.chartMini} style={{ height: 150 }}>
      <BarChart data={data}>
        <XAxis dataKey="grade" tickLine={false} axisLine={false} fontSize={10} />
        <YAxis tickLine={false} axisLine={false} fontSize={10} hide />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="resolved" stackId="a" fill="var(--primary)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="ongoing" stackId="a" fill="var(--accent)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="unresolved" stackId="a" fill="var(--border)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
const RISK_COLORS: Record<string, string> = {
  High: "#171717",
  Moderate: "#6b7280",
  Low: "#d1d5db",
};
export function Donut({
  data,
  labelKey,
  valueKey,
}: {
  data: Record<string, string | number>[];
  labelKey: string;
  valueKey: string;
}) {
  const total = data.reduce((a, d) => a + Number(d[valueKey]), 0);
  return (
    <div className={styles.donutWrap}>
      <ChartContainer config={CHART_CONFIG} className={styles.chartMini} style={{ height: 150, width: 150 }}>
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey={labelKey} />} />
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={labelKey}
            innerRadius={42}
            outerRadius={62}
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
          >
            {data.map((d) => (
              <Cell key={d[labelKey] as string} fill={RISK_COLORS[d[labelKey] as string] ?? "var(--primary)"} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className={styles.donutLegend}>
        {data.map((d) => (
          <li key={d[labelKey] as string} className={styles.donutLegendItem}>
            <span
              className={styles.donutSwatch}
              style={{ background: RISK_COLORS[d[labelKey] as string] ?? "var(--primary)" }}
            />
            <span className={styles.donutLabel}>{d[labelKey] as string}</span>
            <span className={styles.donutValue}>
              {d[valueKey] as number}
              <span className={styles.donutPct}>
                {total ? Math.round((Number(d[valueKey]) / total) * 100) : 0}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
