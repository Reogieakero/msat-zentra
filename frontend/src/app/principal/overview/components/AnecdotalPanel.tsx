import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PieChart as RechartsPieChart, Pie, Cell } from "recharts";
import { TabLink } from "./TabLink";
import {
  ANECDOTAL_CATEGORIES,
  categoryConfig,
  ANECDOTAL_STUDENTS,
} from "./data";
import styles from "./anecdotal-panel.module.css";

export function AnecdotalPanel({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const total = ANECDOTAL_CATEGORIES.reduce((s, c) => s + c.value, 0);
  const topCategory = [...ANECDOTAL_CATEGORIES].sort(
    (a, b) => b.value - a.value
  )[0].label;
  const behavioralBullyingPct = Math.round(
    ((ANECDOTAL_CATEGORIES.find((c) => c.key === "behavioral")?.value ?? 0) +
      (ANECDOTAL_CATEGORIES.find((c) => c.key === "bullying")?.value ?? 0)) /
      total *
      100
  );

  return (
    <div className={styles.anecdotalPanel}>
      <div className={styles.anecdotalTop}>
        <div className={styles.anecdotalChart}>
          <ChartContainer
            id="anecdotal-categories"
            config={categoryConfig as ChartConfig}
            className={styles.donutWrap}
          >
            <RechartsPieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent nameKey="label" hideLabel />}
              />
              <Pie
                data={ANECDOTAL_CATEGORIES}
                dataKey="value"
                nameKey="key"
                innerRadius={26}
                outerRadius={42}
                paddingAngle={2}
              >
                {ANECDOTAL_CATEGORIES.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
            </RechartsPieChart>
          </ChartContainer>
        </div>

        <ul className={styles.donutLegend}>
          {ANECDOTAL_CATEGORIES.map((c) => (
            <li key={c.key} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ backgroundColor: c.color }}
                aria-hidden
              />
              <span className={styles.legendLabel}>{c.label}</span>
              <span className={styles.legendValue}>{c.value}</span>
            </li>
          ))}
        </ul>

        <div className={styles.anecdotalSummary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>{total}</span>
            <span className={styles.summaryLabel}>Total Records</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>{topCategory}</span>
            <span className={styles.summaryLabel}>Top Category</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>{behavioralBullyingPct}%</span>
            <span className={styles.summaryLabel}>Behavioral + Bullying</span>
          </div>
        </div>
      </div>

      <div className={styles.anecdotalTableCard}>
        <h3 className={styles.tableTitle}>Recently Logged Learners</h3>
        <div className={styles.tableScroll}>
          <table className={styles.anecdotalTable}>
            <thead>
              <tr>
                <th>LRN</th>
                <th>Section</th>
                <th>Year</th>
                <th>Added</th>
                <th>Adviser</th>
              </tr>
            </thead>
            <tbody>
              {ANECDOTAL_STUDENTS.map((s) => (
                <tr key={s.lrn}>
                  <td className={styles.mono}>{s.lrn}</td>
                  <td>{s.section}</td>
                  <td>{s.year}</td>
                  <td>{s.dateAdded}</td>
                  <td>{s.adviser}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TabLink href={href} label={label} />
    </div>
  );
}
