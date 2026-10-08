"use client";

import * as React from "react";
import { AttendanceSummary } from "./components/AttendanceSummary";
import { SectionAverages } from "./components/SectionAverages";
import { SchoolTrend } from "./components/SchoolTrend";
import {
  SectionAttendanceModal,
  type SectionSelection,
} from "./components/SectionAttendanceModal";
import styles from "./components/attendance.module.css";

export default function PrincipalAttendanceHeatmapsPage() {
  const [drillOpen, setDrillOpen] = React.useState(false);
  const [drillSelection, setDrillSelection] =
    React.useState<SectionSelection | null>(null);
  const openSection = React.useCallback(
    (sectionId: string, sectionName: string) => {
      setDrillSelection({ sectionId, sectionName });
      setDrillOpen(true);
    },
    []
  );

  return (
    <section className={styles.page}>
      <AttendanceSummary />
      <div className={styles.stack}>
        <SchoolTrend />
        <SectionAverages onInspectSection={openSection} />
      </div>
      <SectionAttendanceModal
        open={drillOpen}
        selection={drillSelection}
        onPick={(s) => setDrillSelection(s)}
        onBack={() => setDrillSelection(null)}
        onClose={() => setDrillOpen(false)}
      />
    </section>
  );
}
