"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, SearchIcon } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";
import { SectionCardGrid } from "./SectionCardGrid";
import { SectionStudentsTable } from "./SectionStudentsTable";
import type { AcademicsMock } from "@/services/principal/academics";
import styles from "./StudentsAcademicsGrid.module.css";

/**
 * Two-view orchestrator: the section board, or one section's roster.
 *
 * Selecting a card swaps the whole board out for that section (the roster is
 * the only thing worth reading once a section is chosen); "Show all sections"
 * brings the board back. Each view is keyed so it remounts and plays its own
 * entrance — the boards cascade back in rather than popping.
 */
export function StudentsAcademicsGrid() {
  const [selectedSectionId, setSelectedSectionId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const detailRef = React.useRef<HTMLDivElement | null>(null);
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const hadSelection = React.useRef(false);

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

  // Every roster opens unfiltered, so a search never leaks across sections.
  const selectSection = React.useCallback((id: string | null) => {
    setQuery("");
    setSelectedSectionId(id);
  }, []);

  // Opening a section pulls the roster into view; returning restores the board
  // to the top so the cascade is actually seen. Reduced motion scrolls plainly.
  React.useEffect(() => {
    const target = selectedSectionId ? detailRef.current : hadSelection.current ? gridRef.current : null;
    hadSelection.current = Boolean(selectedSectionId);
    if (!target) return;
    const smooth =
      typeof window !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  }, [selectedSectionId]);

  return (
    <section className={styles.section}>
      {error ? (
        <p className={styles.error}>{error}</p>
      ) : selectedSection ? (
        <div key={selectedSection.sectionId} ref={detailRef} className={styles.detail}>
          <div className={styles.detailBar}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={styles.backBtn}
              onClick={() => selectSection(null)}
            >
              <ArrowLeft data-icon="inline-start" aria-hidden />
              Show all sections
            </Button>
            <span className={styles.detailHint}>
              Viewing the roster for
              <Pill tone="amber" label="Section">
                {selectedSection.section}
              </Pill>
              <Pill tone="neutral" label="Grade level" className="tabular-nums">
                {selectedSection.grade}
              </Pill>
              <Pill tone="blue" label="Students" className="tabular-nums">
                {selectedSection.students?.length ?? 0}
              </Pill>
            </span>
            <InputGroup className={cn(styles.detailSearch, "rounded-[16px]")}>
              <InputGroupInput
                placeholder="Filter students..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Filter students"
              />
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
            </InputGroup>
          </div>
          <SectionStudentsTable section={selectedSection} query={query} />
        </div>
      ) : (
        <div key="all-sections" ref={gridRef} className={styles.gridAnchor}>
          <SectionCardGrid
            sections={sections}
            loading={loading}
            selectedSectionId={selectedSectionId}
            onSelectSection={selectSection}
          />
        </div>
      )}
    </section>
  );
}
