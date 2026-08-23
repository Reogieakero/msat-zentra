import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PieChart as RechartsPieChart, Pie, Cell } from "recharts";
import { TabLink } from "./TabLink";
import { SF10_LEVELS, SF10_STATUS_META, GRADE_ORDER } from "./data";
import type { Sf10Status } from "./data";
import styles from "./sf10-panel.module.css";

const SF10_STATUSES: Sf10Status[] = ["attached", "available", "missing"];

export function Sf10Panel({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const counts = {
    missing: SF10_LEVELS.reduce((s, l) => s + l.missing, 0),
    available: SF10_LEVELS.reduce((s, l) => s + l.available, 0),
    attached: SF10_LEVELS.reduce((s, l) => s + l.attached, 0),
  };
  const sf10DonutData = SF10_STATUSES.map((s) => ({
    status: s,
    value: counts[s],
    color: SF10_STATUS_META[s].color,
  }));

  const sf10DonutConfig = sf10DonutData.reduce<ChartConfig>((acc, d) => {
    acc[d.status] = { label: SF10_STATUS_META[d.status].label, color: d.color };
    return acc;
  }, {});

  return (
    <div className={styles.sf10Panel}>
      <div className={styles.admTop}>
        <div className={styles.sf10DonutGroup}>
          <span className={styles.admDonut}>
            <ChartContainer
              id="sf10-donut"
              config={sf10DonutConfig}
              className={styles.admDonutWrap}
            >
              <RechartsPieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent nameKey="status" hideLabel />}
                />
                <Pie
                  data={sf10DonutData}
                  dataKey="value"
                  nameKey="status"
                  innerRadius={20}
                  outerRadius={34}
                  stroke="none"
                  isAnimationActive={false}
                  paddingAngle={2}
                >
                  {sf10DonutData.map((d) => (
                    <Cell key={d.status} fill={d.color} />
                  ))}
                </Pie>
              </RechartsPieChart>
            </ChartContainer>
          </span>

          <ul className={styles.sf10DonutLegend}>
            {sf10DonutData.map((d) => (
              <li key={d.status} className={styles.sf10SummaryItem}>
                <span
                  className={styles.sf10SummaryDot}
                  style={{ backgroundColor: d.color }}
                  aria-hidden
                />
                <span className={styles.sf10SummaryValue}>{d.value}</span>
                <span className={styles.sf10SummaryLabel}>
                  {SF10_STATUS_META[d.status].label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.sf10SummaryTotal}>
          <span className={styles.sf10SummaryValue}>
            {counts.attached + counts.available + counts.missing}
          </span>
          <span className={styles.sf10SummaryLabel}>Total Records</span>
        </div>
      </div>

      <div className={styles.sf10Grid}>
        {GRADE_ORDER.map((grade) => {
          const level = SF10_LEVELS.find((l) => l.grade === grade);
          if (!level) return null;
          return (
            <div key={grade} className={styles.sf10Grade}>
              <span className={styles.sf10GradeName}>{grade}</span>
              <div className={styles.sf10Levels}>
                {SF10_STATUSES.map((s) => (
                  <div
                    key={s}
                    className={styles.sf10LevelStat}
                    style={{ borderColor: SF10_STATUS_META[s].color }}
                  >
                    <span
                      className={styles.sf10LevelValue}
                      style={{ color: SF10_STATUS_META[s].color }}
                    >
                      {level[s]}
                    </span>
                    <span className={styles.sf10LevelLabel}>
                      {SF10_STATUS_META[s].label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <TabLink href={href} label={label} />
    </div>
  );
}
