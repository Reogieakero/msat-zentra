"use client";

import * as React from "react";
import { AttendanceSummary } from "./components/AttendanceSummary";
import { SchoolTrend } from "./components/SchoolTrend";
import styles from "./components/attendance.module.css";

export default function PrincipalAttendanceHeatmapsPage() {
  return (
    <section className={styles.page}>
      <AttendanceSummary />
      <div className={styles.stack}>
        <SchoolTrend />
      </div>
    </section>
  );
}
