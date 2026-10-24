"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTerm } from "@/lib/term/TermContext";
import { Grid3X3, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import { ZentraPageHeaderSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { GuidancePageHeader } from "../../components/GuidancePageHeader";
import { GuidanceEmptyCard } from "../../components/GuidanceEmptyCard";
import { fetchGuidanceRiskHeatmap } from "@/services/guidance/risk.service";
import { GuidanceHeatmapVisual } from "./components/guidance-heatmap-visual";
import { GuidanceSectionCards } from "./components/guidance-section-cards";
import styles from "../../pages.module.css";

export default function GuidanceHeatmapPage() {
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ["guidance-risk-heatmap", termKey],
    queryFn: () => fetchGuidanceRiskHeatmap(),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled: termReady,
  });

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading risk heatmap">
        <ZentraPageHeaderSkeleton withActions actionCount={3} />
        <div className={styles.actions}>
          <Skeleton style={{ width: "11rem", height: "2rem" }} />
          <Skeleton style={{ width: "7rem", height: "2rem" }} />
        </div>

        <KanbanBoard
          title={<Skeleton style={{ width: "15rem", height: "1rem" }} />}
          description={<Skeleton style={{ width: "24rem", maxWidth: "100%", height: "0.8rem" }} />}
          className={styles.card}
          ariaLabel="Loading heatmap sections"
        >
          {[0, 1].map((block) => (
            <div key={block} style={{ marginBottom: block === 0 ? "1.25rem" : 0 }}>
              <Skeleton style={{ width: "11rem", height: "0.85rem" }} />
              <Skeleton style={{ width: "19rem", maxWidth: "100%", height: "0.75rem", marginTop: "0.375rem" }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.5rem", marginTop: "0.625rem" }}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <Skeleton key={i} style={{ width: "100%", height: "2.125rem" }} />
                ))}
              </div>
            </div>
          ))}
        </KanbanBoard>

        <KanbanBoard
          title={<Skeleton style={{ width: "8rem", height: "1rem" }} />}
          description={<Skeleton style={{ width: "20rem", maxWidth: "100%", height: "0.8rem" }} />}
          className={styles.card}
          ariaLabel="Loading section cards"
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(17rem, 1fr))", gap: "0.75rem" }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "0.75rem 0.875rem" }}>
                <Skeleton style={{ width: "55%", height: "0.85rem" }} />
                <Skeleton style={{ width: "35%", height: "0.75rem", marginTop: "0.375rem" }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.5rem", marginTop: "0.625rem" }}>
                  {[0, 1, 2].map((j) => (
                    <Skeleton key={j} style={{ width: "100%", height: "2.75rem" }} />
                  ))}
                </div>
                <Skeleton style={{ width: "70%", height: "0.75rem", marginTop: "0.625rem" }} />
                <Skeleton style={{ width: "100%", height: "0.75rem", marginTop: "0.5rem" }} />
              </div>
            ))}
          </div>
        </KanbanBoard>
        <Skeleton style={{ width: "100%", height: "2.5rem" }} />
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page} aria-label="Risk heatmap">
        <GuidancePageHeader title="Attendance × Academic Heatmap" />
        <KanbanBoard
          title="We couldn&apos;t load the heatmap"
          icon={<Grid3X3 className="size-3.5" aria-hidden="true" />}
          description="Check your connection and try again."
          className={styles.card}
        >
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="animate-spin" aria-hidden style={{ width: "1rem", height: "1rem" }} />
            ) : null}
            {isFetching ? "Retrying…" : "Retry"}
          </Button>
        </KanbanBoard>
      </section>
    );
  }

  return (
    <section className={styles.page} aria-label="Risk heatmap">
      {data.rows.length === 0 ? null : (
        <GuidancePageHeader
          title="Attendance × Academic Heatmap"
          description={`Live section × risk-factor matrix for ${data.termLabel}. Factor columns count flagged students; level columns cover the full enrolled cohort.`}
          actions={
            <>
              <Badge variant="outline">Live · {data.termLabel}</Badge>
              <Button asChild size="sm" variant="outline">
                <Link href="/guidance/adm">Back to risk watch</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/guidance/alerts">At-risk queue</Link>
              </Button>
            </>
          }
        />
      )}
      {data.rows.length === 0 ? (
        <GuidanceEmptyCard
          icon={Grid3X3}
          title="No sections this term"
          hint="No sections enrolled for the active school year yet."
          label="Risk heatmap"
          centered
        />
      ) : (
        <>

      <KanbanBoard
        title="Section × risk factor heatmap"
        icon={<Grid3X3 className="size-3.5" aria-hidden="true" />}
        description={
          data.rows.length === 0
            ? "No sections enrolled for the active school year yet."
            : `Academic ${data.totals.academic} · Attendance ${data.totals.attendance} · Behavioral ${data.totals.behavioral} flagged students across ${data.rows.length} section${data.rows.length === 1 ? "" : "s"}. Darker = more students.`
        }
        className={styles.card}
      >
        {data.rows.length > 0 ? (
          <GuidanceHeatmapVisual rows={data.rows} totals={data.totals} />
        ) : null}
      </KanbanBoard>

      <KanbanBoard
        title="Sections"
        icon={<Grid3X3 className="size-3.5" aria-hidden="true" />}
        description={`One card per section — same live data. Follow-ups: ${data.totals.followUpOngoing} ongoing · ${data.totals.followUpDone} done · ${data.totals.followUpNone} not started.`}
        className={styles.card}
      >
        {data.rows.length > 0 ? (
          <GuidanceSectionCards rows={data.rows} />
        ) : null}
      </KanbanBoard>

      <p className={styles.note}>
        {data.truncated
          ? "Very large caseload: factor columns cover the first 1,000 flagged students — level columns are exact. "
          : ""}
        Term-scoped, snapshot-backed aggregates; the flagged caseload itself
        lives in the at-risk queue.
      </p>
        </>
      )}
    </section>
  );
}
