"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchHeatmap } from "./api";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { StudentsHeader } from "./components/StudentsHeader";
import { StudentsKpiRail } from "./components/StudentsKpiRail";
import { StudentHeatmap } from "./components/StudentHeatmap";
import { StudentsListTable } from "./components/StudentsListTable";
import styles from "./students.module.css";

const ACTIVE_SECTION_KEY = "zentra.risk.students.activeSection";

export default function RiskBoardStudentsPage() {
  const [selectedSection, setSelectedSection] = usePersistentState<string>(
    ACTIVE_SECTION_KEY,
    "all"
  );

  const { data: heat, isPending: heatLoading } = useQuery({
    queryKey: ["risk-heatmap"],
    queryFn: fetchHeatmap,
  });

  return (
    <section className={styles.page}>
      <StudentsHeader />

      <hr className={styles.divider} />

      <StudentsKpiRail />

      <StudentHeatmap
        heat={heat ?? null}
        loading={heatLoading}
        selectedSection={selectedSection === "all" ? null : selectedSection}
        onSelect={setSelectedSection}
      />

      <StudentsListTable
        selectedSection={selectedSection}
        onSectionChange={setSelectedSection}
      />
    </section>
  );
}
