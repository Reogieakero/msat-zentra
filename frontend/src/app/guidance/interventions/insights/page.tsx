"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  GraduationCap,
  Loader2,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import {
  KanbanBoardSkeleton,
  ZentraPageHeaderSkeleton,
} from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { GuidancePageHeader } from "../../components/GuidancePageHeader";
import { fetchGuidanceInterventionInsights } from "@/services/guidance/insights.service";
import type { InterventionInsightsData } from "@/services/guidance/insights.types";
import { useTerm } from "@/lib/term/TermContext";
import { InsightsKpis } from "./components/insights-kpis";
import { InsightsTrendBoard } from "./components/insights-trend-board";
import { InsightsSessionBoard } from "./components/insights-session-board";
import { InsightsOutcomeBoard } from "./components/insights-outcome-board";
import { InsightsHeatmap } from "./components/insights-heatmap";
import pageStyles from "../../pages.module.css";
import styles from "./components/insights.module.css";

export default function GuidanceInterventionInsightsPage() {
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const { data, isPending, isError, refetch, isFetching } =
    useQuery<InterventionInsightsData>({
      queryKey: ["guidance-intervention-insights", termKey],
      queryFn: ({ signal }) => fetchGuidanceInterventionInsights(signal),
      placeholderData: keepPreviousData,
      staleTime: 60_000,
      enabled: termReady,
    });

  if (isPending) {
    return (
      <section
        className={pageStyles.page}
        aria-busy="true"
        aria-label="Loading intervention insights"
      >
        <ZentraPageHeaderSkeleton withActions actionCount={1} />
        <div className={pageStyles.kpiGrid}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-md" aria-hidden="true" />
          ))}
        </div>
        <div className={pageStyles.grid2}>
          {[0, 1].map((i) => (
            <KanbanBoardSkeleton
              key={i}
              titleWidth="10rem"
              rows={0}
              showCount
              showDescription
              className="flex-1"
            >
              <Skeleton className="h-64 w-full rounded-md" aria-hidden="true" />
            </KanbanBoardSkeleton>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <KanbanBoardSkeleton
              key={i}
              titleWidth="10rem"
              rows={0}
              showCount
              showDescription
              className="flex-1"
            >
              <Skeleton className="h-48 w-full rounded-md" aria-hidden="true" />
            </KanbanBoardSkeleton>
          ))}
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={pageStyles.page} aria-label="Intervention insights">
        <GuidancePageHeader title="Intervention insights" />
        <KanbanBoard
          title="We couldn&apos;t load intervention insights"
          icon={<TrendingUp className="size-3.5" aria-hidden="true" />}
          description="Check your connection and try again."
          className={pageStyles.card}
        >
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? <Loader2 className={styles.spin} aria-hidden="true" /> : null}
            {isFetching ? "Retrying…" : "Retry"}
          </Button>
        </KanbanBoard>
      </section>
    );
  }

  const refreshing = isFetching && !isPending;

  return (
    <section
      className={pageStyles.page}
      aria-busy={refreshing}
      aria-label="Intervention insights"
    >
      <GuidancePageHeader
        title="Intervention insights"
        description={`Aggregated intervention performance for ${data.termLabel} — openings, resolutions, session delivery, success by risk and grade, and section-level outcomes.`}
        actions={
          <Pill
            tone="green"
            label="Live term — figures update as intervention cases and sessions are recorded"
          >
            Live · {data.termLabel}
          </Pill>
        }
      />

      <InsightsKpis kpis={data.kpis} />

      <div className={pageStyles.grid2}>
        <InsightsTrendBoard rows={data.monthlyTrend} termLabel={data.termLabel} />
        <InsightsSessionBoard rows={data.sessionsByType} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <InsightsOutcomeBoard
          title="Success by risk level"
          description="Closed vs. open follow-ups at the risk level flagged when the case was opened."
          rows={data.successByRisk}
          icon={ShieldCheck}
          emptyTitle="No interventions recorded"
          emptyText="Risk-level success rates appear once follow-ups exist this term."
          interpretation="High-risk cases should still close at a healthy rate — if they don't, they need earlier escalation rather than more sessions."
        />
        <InsightsOutcomeBoard
          title="Success by grade"
          description="Which grade levels resolve their intervention cases and which keep them open."
          rows={data.successByGrade}
          icon={GraduationCap}
          emptyTitle="No grade-level data"
          emptyText="Grade success rates appear once follow-ups exist this term."
          interpretation="Grade bands that lag the school average usually point to a section-level or advisory follow-through gap."
          variant="donut"
        />
      </div>

      <InsightsHeatmap rows={data.sectionHeat} termLabel={data.termLabel} />
    </section>
  );
}
