"use client";

import { Flag, GraduationCap, HeartPulse } from "lucide-react";
import { GuidanceBarPanel, GuidanceDonutPanel } from "./guidance-overview-panels";
import type {
  GuidanceCategoryRow,
  GuidanceRiskByGradeRow,
} from "@/services/guidance/overview.types";
import styles from "./guidance-overview.module.css";

interface GuidanceOverviewRiskChartsProps {
  riskByLevel: { high: number; moderate: number; low: number };
  factorTotals: { attendance: number; grades: number; behavior: number };
  riskByGrade: GuidanceRiskByGradeRow[];
}

/**
 * Risk section — three kanban boards (donut + two bar charts) in the same
 * 3-up grid and amber palette as the nurse breakdown boards.
 */
export function GuidanceOverviewRiskCharts({
  riskByLevel,
  factorTotals,
  riskByGrade,
}: GuidanceOverviewRiskChartsProps) {
  const levelRows = [
    { key: "high", label: "High", count: riskByLevel.high },
    { key: "moderate", label: "Moderate", count: riskByLevel.moderate },
    { key: "low", label: "Low", count: riskByLevel.low },
  ];

  const factorRows = [
    { key: "grades", label: "Academic", count: factorTotals.grades },
    { key: "attendance", label: "Attendance", count: factorTotals.attendance },
    { key: "behavior", label: "Behavioral", count: factorTotals.behavior },
  ];

  const gradeRows = riskByGrade.map((r) => ({
    key: r.short,
    label: r.short,
    count: r.count,
  }));

  const levelTotal = riskByLevel.high + riskByLevel.moderate + riskByLevel.low;
  const levelsText =
    levelTotal === 0
      ? "No enrolled students found for the active school year."
      : `${riskByLevel.high} high and ${riskByLevel.moderate} moderate out of ${levelTotal} students recomputed live for the active term.`;

  const factorTotal =
    factorTotals.attendance + factorTotals.grades + factorTotals.behavior;
  const factorsText =
    factorTotal === 0
      ? "No risk flags tripped this term — every student clears all three checks."
      : `${factorTotals.grades} academic, ${factorTotals.attendance} attendance, and ${factorTotals.behavior} behavioral flags active. One student can trip several flags.`;

  const topGrade = [...riskByGrade].sort((a, b) => b.count - a.count)[0];
  const gradeText =
    !topGrade || topGrade.count === 0
      ? "No grade level has at-risk students right now."
      : `Highest: ${topGrade.grade} with ${topGrade.count} students needing attention.`;

  return (
    <div className={styles.threeCol}>
      <GuidanceDonutPanel
        title="Risk levels"
        description="Live recompute · High ≥ 2 flags, Moderate = 1, Low = 0."
        rows={levelRows}
        unit="students"
        emptyTitle="No students enrolled"
        emptyText="No enrolled students found for the active school year."
        icon={HeartPulse}
        sortDescending={false}
        interpretation={levelsText}
      />
      <GuidanceBarPanel
        title="Risk factors"
        description="Students tripping each flag this term."
        rows={factorRows}
        seriesName="Students"
        emptyTitle="No risk flags this term"
        emptyText="No risk flags tripped this term — every student clears all three checks."
        icon={Flag}
        interpretation={factorsText}
      />
      <GuidanceBarPanel
        title="At-risk by grade"
        description="Moderate + High students per grade level."
        rows={gradeRows}
        seriesName="At-risk"
        emptyTitle="No at-risk students"
        emptyText="No grade level has at-risk students right now."
        icon={GraduationCap}
        sortDescending={false}
        interpretation={gradeText}
      />
    </div>
  );
}

export type { GuidanceCategoryRow };
