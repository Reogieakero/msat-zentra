"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { InsightCallout } from "@/components/ui/insight-callout";
import {
  SectionScheduleTable as ScheduleTable,
  type ScheduleSection,
} from "@/components/schedule/section-schedule-table";
import { ScheduleRail } from "./components/schedule-rail";
import { sectionPath } from "./components/section-path";
import { ScheduleSkeleton } from "./components/schedule-skeleton";
import { ScheduleReviewOverlay } from "./components/schedule-review-overlay";
import page from "./components/schedule.module.css";

export default function PrincipalSchedulePage() {
  const { termReady } = useTerm();
  const [reviewSection, setReviewSection] = useState<ScheduleSection | null>(null);
  const sectionsQuery = useQuery<{ sections: ScheduleSection[] }>({
    queryKey: ["principal-schedule-sections"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ sections: ScheduleSection[] }>(
        "/api/academics/schedule/sections",
      );
      return data;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: termReady,
  });

  const sections = sectionsQuery.data?.sections ?? [];
  const isEmpty = !sectionsQuery.isPending && !sectionsQuery.isError && sections.length === 0;
  const loading = sectionsQuery.isPending || !termReady;

  return (
    <section className={page.page} aria-busy={loading || undefined}>
      {sectionsQuery.isPending ? (
        <ScheduleSkeleton />
      ) : sectionsQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load sections.
        </p>
      ) : isEmpty ? (
        // Empty board reads as a plain insight callout centered in the page —
        // same treatment as the academics section board and assign board.
        <div className={page.emptyCallout}>
          <InsightCallout role="status">
            No sections yet for this school year. Sections for grades 7–12 will appear
            here once created.
          </InsightCallout>
        </div>
      ) : (
        <>
          <div className={page.topBar}>
            <ScheduleRail sections={sections} />
          </div>
          <div className={page.stack}>
            <ScheduleTable sections={sections} onReview={setReviewSection} hrefFor={sectionPath} />
          </div>
        </>
      )}
      <ScheduleReviewOverlay section={reviewSection} onClose={() => setReviewSection(null)} />
    </section>
  );
}
