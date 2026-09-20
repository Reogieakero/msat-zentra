"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/components/providers";
import {
  CARD_SURFACE_DARK,
  CARD_SURFACE_LIGHT,
  LEVEL_COLORS_DARK,
  LEVEL_COLORS_LIGHT,
  type LevelSlice,
} from "./nurse-risk-data";
import styles from "./NurseRiskLevels.module.css";

/**
 * Students on the clinic desk by risk level — one learner counts once no
 * matter how many cases they carry. Each slice links to nothing; levels
 * only, no identities.
 */
export function NurseRiskLevels({
  mix,
  totalStudents,
  interpretation,
}: {
  mix: LevelSlice[];
  totalStudents: number;
  interpretation: string;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const colors = isDark ? LEVEL_COLORS_DARK : LEVEL_COLORS_LIGHT;
  const surface = isDark ? CARD_SURFACE_DARK : CARD_SURFACE_LIGHT;
  return (
    <Card className={styles.panel}>
      <h2 className={styles.panelTitle}>Students by risk level</h2>
      <p className={styles.panelDesc}>
        Live levels for learners with a case on the clinic desk.
      </p>
      {totalStudents === 0 ? (
        <p className={styles.empty}>No students on the desk yet.</p>
      ) : (
        <div
          className={styles.chartRow}
          role="img"
          aria-label={`Students by risk level: ${mix.map((s) => `${s.label} ${s.count}`).join(", ")}`}
        >
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={mix}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="64%"
                  outerRadius="100%"
                  paddingAngle={2}
                  stroke={surface}
                  strokeWidth={2}
                  isAnimationActive
                  animationDuration={700}
                >
                  {mix.map((d) => (
                    <Cell key={d.key} fill={colors[d.key]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.center} aria-hidden="true">
              <span className={styles.centerValue}>{totalStudents}</span>
              <span className={styles.centerLabel}>
                {totalStudents === 1 ? "student" : "students"}
              </span>
            </div>
          </div>

          <ul className={styles.legend}>
            {mix.map((s) => (
              <li key={s.key} className={styles.legendItem}>
                <span
                  className={styles.swatch}
                  style={{ background: colors[s.key] }}
                  aria-hidden="true"
                />
                <span className={styles.legendLabel}>{s.label}</span>
                <span className={styles.legendValue}>{s.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className={styles.interpretation}>
        <span className={styles.interpretationLabel}>What it means · </span>
        {interpretation}
      </p>
    </Card>
  );
}
