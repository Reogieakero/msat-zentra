"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { MousePointerClick } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { useGradeMode } from "../../grade-mode-context";
import { SectionCardGrid } from "./SectionCardGrid";
import { SectionStudentsTable } from "./SectionStudentsTable";
import type { AcademicsMock } from "@/services/principal/academics";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./StudentsAcademicsGrid.module.css";

/* Academics desk: a section card grid on top; the students data table
   (teacher At-Risk Advisees pattern) renders only once a section card
   is clicked/selected. */
export function StudentsAcademicsGrid() {
  const { gradeMode } = useGradeMode();
  const [selectedSectionId, setSelectedSectionId] = React.useState<string | null>(null);
  const tableRef = React.useRef<HTMLDivElement | null>(null);

  const { activeTerm } = useTerm();
  const termId = activeTerm?.termId ?? null;
  const {
    data,
    isPending,
    error: queryError,
  } = useQuery({
    // Term-scoped shared summary (heatmaps/honor-roll select from their own
    // keys; backend caches per term). No polling — realtime invalidates.
    queryKey: ["academics", termId, gradeMode],
    queryFn: async () =>
      (await apiClient.get<AcademicsMock>("/api/academics", { params: { mode: gradeMode } })).data,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const sections = React.useMemo(() => data?.sections ?? [], [data]);

  const loading = isPending;

  const error = React.useMemo(() => {
    if (!queryError) return null;
    const status = (queryError as { response?: { status?: number } })?.response?.status;
    return status
      ? `Failed to load student grades (HTTP ${status})`
      : "Failed to load student grades";
  }, [queryError]);

  const selectedSection = React.useMemo(
    () => sections.find((s) => s.sectionId === selectedSectionId) ?? null,
    [sections, selectedSectionId],
  );

  // Reveal the table below the grid when a card is picked.
  React.useEffect(() => {
    if (!selectedSectionId || !tableRef.current) return;
    const smooth =
      typeof window !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    tableRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  }, [selectedSectionId]);

  return (
    <section className={styles.section}>
      {error ? (
        <p className={styles.error}>{error}</p>
      ) : (
        <>
          <SectionCardGrid
            sections={sections}
            loading={loading}
            selectedSectionId={selectedSectionId}
            onSelectSection={setSelectedSectionId}
          />
          {selectedSection ? (
            <div ref={tableRef} className={styles.tableAnchor}>
              <SectionStudentsTable
                section={selectedSection}
                gradeMode={gradeMode}
              />
            </div>
          ) : !loading && sections.length > 0 ? (
            <div className={assign.card} aria-label="No section selected">
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className={styles.hintBody}>
                <span className={styles.hintIconWrap} aria-hidden="true">
                  <MousePointerClick className={styles.hintIcon} />
                </span>
                <p className={styles.hintTitle}>No section selected</p>
                <p className={styles.hintText}>
                  Select a section card above to view its students — averages
                  compute live across all subjects.
                </p>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
