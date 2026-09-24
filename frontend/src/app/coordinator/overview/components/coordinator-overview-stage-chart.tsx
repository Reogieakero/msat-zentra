"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { StageDonutEntry } from "./coordinator-overview-helpers";
import styles from "./coordinator-overview-stage-chart.module.css";

export function CoordinatorOverviewStageChart({
  stageDonut,
}: {
  stageDonut: StageDonutEntry[];
}) {
  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>Cases by stage</h2>
      <p className={styles.sectionDesc}>Live pipeline distribution.</p>
      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={stageDonut}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="90%"
              stroke="var(--card)"
            >
              {stageDonut.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [value, "Cases"]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className={styles.evidenceList}>
        {stageDonut.map((d) => (
          <li key={d.name} className={styles.evidenceItem}>
            <span
              className={styles.evidenceDot}
              style={{ backgroundColor: d.fill }}
              aria-hidden
            />
            <strong className={styles.evidenceCount}>{d.value}</strong>
            <span className={styles.studentSub}>{d.full}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
