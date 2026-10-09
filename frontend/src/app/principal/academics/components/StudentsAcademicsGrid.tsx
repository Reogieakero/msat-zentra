"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { MousePointerClick } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { SectionCardGrid } from "./SectionCardGrid";
import { SectionStudentsTable } from "./SectionStudentsTable";
import type { AcademicsMock } from "@/services/principal/academics";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { PrincipalEmptyState } from "../../components/PrincipalEmptyCard";
import styles from "./StudentsAcademicsGrid.module.css";

export function StudentsAcademicsGrid() {
  const [selectedSectionId, setSelectedSectionId] = React.useState<string | null>(null);
  const tableRef = React.useRef<HTMLDivElement | null>(null);

  const { activeTerm } = useTerm();
  const termId = activeTerm?.termId ?? null;
  const schoolYearId = activeTerm?.schoolYearId ?? null;
  const {
    data,
    isPending,
    error: queryError,
  } = useQuery({
    queryKey: ["academics", termId, schoolYearId],
    queryFn: async () => {
      const { data } = await apiClient.get<AcademicsMock>("/api/academics");
      return {
        ...data,
        sections: (data.sections ?? []).map((s) => ({ ...s, students: s.students ?? [] })),
      };
    },
    staleTime: 15_000,
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
              <SectionStudentsTable section={selectedSection} />
            </div>
          ) : !loading && sections.length > 0 ? (
            <div className={assign.card} aria-label="No section selected">
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <PrincipalEmptyState
                icon={MousePointerClick}
                title="No section selected"
                hint="Select a section card above to view its students — averages compute live across all subjects."
              />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
