"use client";

import { NotebookPen, CalendarOff, FileSignature, FileBarChart } from "lucide-react";
import { SchoolCard } from "./components/SchoolCard";
import { BrowserWindow } from "./components/BrowserWindow";
import { AttendanceHeatmap } from "./components/AttendanceHeatmap";
import { ActionRequired } from "./components/ActionRequired";
import { TABS, MOCK } from "./components/data";
import type { TabDef } from "./components/data";
import styles from "./overview.module.css";

const TAB_DEFS: TabDef[] = TABS.map((t) => ({
  ...t,
  icon:
    t.id === "anecdotal"
      ? NotebookPen
      : t.id === "attendance"
        ? CalendarOff
        : t.id === "adm"
          ? FileSignature
          : FileBarChart,
}));

export default function PrincipalOverviewPage() {
  const data = MOCK;

  return (
    <section className={styles.page}>
      <div className={styles.grid}>
        <SchoolCard schoolName={data.schoolName} kpis={data.kpis} />
        <BrowserWindow tabs={TAB_DEFS} />
      </div>
      <AttendanceHeatmap />
      <ActionRequired />
    </section>
  );
}
