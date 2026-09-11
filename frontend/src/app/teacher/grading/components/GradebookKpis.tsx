"use client";

import * as React from "react";
import type { TeacherKpiRow } from "../../overview/components/teacher-overview-data";
import styles from "./GradebookKpis.module.css";

type Props = {
  kpi: TeacherKpiRow;
  assessedPct: number;
};

export function GradebookKpis({ kpi, assessedPct }: Props) {
  return (
    <div className={styles.kpis}>
      <div className={styles.kpi}>
        <span className={styles.kpiValue}>{kpi.classCount}</span>
        <span className={styles.kpiLabel}>Classes</span>
      </div>
      <div className={styles.kpi}>
        <span className={styles.kpiValue}>{kpi.studentCount}</span>
        <span className={styles.kpiLabel}>Students</span>
      </div>
      <div className={styles.kpi}>
        <span className={styles.kpiValue}>{kpi.pendingAssessments}</span>
        <span className={styles.kpiLabel}>Pending assessments</span>
      </div>
      <div className={styles.kpi}>
        <span className={styles.kpiValue}>{assessedPct}%</span>
        <span className={styles.kpiLabel}>Students assessed</span>
      </div>
    </div>
  );
}
