"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchHeatmap } from "@/services/principal/riskStudents.service";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { StudentHeatmap } from "./components/StudentHeatmap";
import { StudentsListTable } from "./components/StudentsListTable";
import { useTerm } from "@/lib/term/TermContext";
import styles from "./students.module.css";

const ACTIVE_SECTION_KEY = "zentra.risk.students.activeSection";

export default function RiskBoardStudentsPage() {
  const { termReady, activeTerm } = useTerm();
  const [selectedSection, setSelectedSection] = usePersistentState<string>(
    ACTIVE_SECTION_KEY,
    "all",
  );

  const termId = activeTerm?.termId ?? null;
  const schoolYearId = activeTerm?.schoolYearId ?? null;
  const { data: heat, isPending: heatLoading } = useQuery({
    queryKey: ["risk-heatmap", termId, schoolYearId],
    queryFn: () => fetchHeatmap(),
    enabled: termReady,
    // Same window as the students table: heatmap + table stay fresh
    // together, skeleton only on genuine first load.
    staleTime: 120_000,
    gcTime: 600_000,
  });

  const tableRef = React.useRef<HTMLDivElement>(null);

  const handleSelectSection = React.useCallback((section: string) => {
    setSelectedSection(section);

    requestAnimationFrame(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      tableRef.current?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    });
  }, [setSelectedSection]);

  return (
    <section className={styles.page} aria-busy={heatLoading || undefined}>
      <StudentHeatmap
        heat={heat ?? null}
        loading={heatLoading}
        selectedSection={selectedSection === "all" ? null : selectedSection}
        onSelect={handleSelectSection}
      />

      <div ref={tableRef} className={styles.tableAnchor}>
        <StudentsListTable
          selectedSection={selectedSection}
        />
      </div>
    </section>
  );
}
