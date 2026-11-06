"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { PrincipalEmptyCard } from "../../components/PrincipalEmptyCard";
import { ScheduleTable, type ScheduleSection } from "./components/schedule-table";
import { ScheduleRail } from "./components/schedule-rail";
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
        <div className="mx-auto w-full max-w-5xl" aria-busy="true" aria-label="Loading sections">
          <div className="flex flex-col gap-3 rounded-xl border border-border p-2.5">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-40 rounded-lg bg-muted/60" />
          </div>
        </div>
      ) : sectionsQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load sections.
        </p>
      ) : isEmpty ? (
        <PrincipalEmptyCard
          icon={CalendarDays}
          title="No sections yet"
          hint="Sections for grades 7–12 will appear here."
          centered
        />
      ) : (
        <div className={page.layout}>
          <div className={page.stack}>
            <ScheduleTable sections={sections} onReview={setReviewSection} />
          </div>
          <ScheduleRail sections={sections} />
        </div>
      )}
      <ScheduleReviewOverlay section={reviewSection} onClose={() => setReviewSection(null)} />
    </section>
  );
}
