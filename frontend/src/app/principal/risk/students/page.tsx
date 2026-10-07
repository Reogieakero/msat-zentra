"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchHeatmap } from "./api";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { useGradeMode } from "../../grade-mode-context";
import { StudentHeatmap } from "./components/StudentHeatmap";
import { StudentsListTable } from "./components/StudentsListTable";
import { PrincipalPageHeader } from "../../components/PrincipalPageHeader";
import styles from "./students.module.css";

const ACTIVE_SECTION_KEY = "zentra.risk.students.activeSection";

export default function RiskBoardStudentsPage() {
  const { gradeMode } = useGradeMode();
  const [selectedSection, setSelectedSection] = usePersistentState<string>(
    ACTIVE_SECTION_KEY,
    "all"
  );

  const { data: heat, isPending: heatLoading } = useQuery({
    queryKey: ["risk-heatmap", gradeMode],
    queryFn: () => fetchHeatmap(gradeMode),
  });

  const tableRef = React.useRef<HTMLDivElement>(null);

  const handleSelectSection = React.useCallback((section: string) => {
    setSelectedSection(section);
    // Let the table re-render with the new filter before scrolling to it.
    requestAnimationFrame(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      tableRef.current?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    });
  }, [setSelectedSection]);

  return (
    <section className={styles.page}>
      <PrincipalPageHeader
        title="At-Risk Students"
        description="All at-risk learners across the school — intensity per section, then the full list."
      />
      <StudentHeatmap
        heat={heat ?? null}
        loading={heatLoading}
        selectedSection={selectedSection === "all" ? null : selectedSection}
        onSelect={handleSelectSection}
      />

      <div ref={tableRef} className={styles.tableAnchor}>
        <StudentsListTable
          selectedSection={selectedSection}
          onSectionChange={setSelectedSection}
        />
      </div>
    </section>
  );
}
