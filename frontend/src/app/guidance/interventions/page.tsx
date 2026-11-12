"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { HeartHandshake, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GuidanceEmptyCard } from "../components/GuidanceEmptyCard";
import { fetchAllGuidanceInterventions } from "@/services/guidance/interventions.service";
import type {
  AtRiskStudentItem,
  GuidanceInterventionsData,
} from "@/services/guidance/interventions.types";
import {
  GuidanceInterventionsTable,
} from "./components/guidance-interventions-table";
import {
  interventionStatusKey,
  type InterventionStatusFilter,
} from "./components/intervention-row-helpers";
import { useTerm } from "@/lib/term/TermContext";
import { guidanceLiveQueryOptions } from "@/lib/api/live";
import styles from "./components/guidance-interventions.module.css";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";

// The board pages a 4×4 card grid; backend allow-lists 16 for this queue.
const GUIDANCE_INTERVENTIONS_PAGE_SIZE = 16;

const STATUS_QUERY =
  /^(all|no_action|booked|session_done|follow_up|risk_cleared|done|discontinued)$/;

function GuidanceInterventionsView({ highlightId }: { highlightId: string | null }) {
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const searchParams = useSearchParams();

  // Filters live in the URL so refresh/back-forward keep them, but the board
  // filters the already-loaded queue locally — typing never triggers a fetch.
  const [query, setQueryInput] = React.useState(() => searchParams.get("q") ?? "");
  // One status filter for the whole board; "No action yet" is where the desk
  // starts, since those are the cases still waiting to be picked up. Search and
  // highlight deep links start unfiltered so the learner they point at is never
  // hidden by the default bucket.
  const [status, setStatusState] = React.useState<InterventionStatusFilter>(() => {
    const fromUrl = searchParams.get("status");
    if (fromUrl && STATUS_QUERY.test(fromUrl)) {
      return fromUrl as InterventionStatusFilter;
    }
    const deepLinked = (searchParams.get("q") ?? "").trim() !== "" || !!highlightId;
    return deepLinked ? "all" : "no_action";
  });

  // One request set for the whole queue, then search / tabs / paging are all
  // client-side (mirrors the alerts desk).
  const {
    data,
    isPending,
    isError,
    refetch,
    isRefetching,
  } = useQuery<GuidanceInterventionsData>({
    ...guidanceLiveQueryOptions,
    queryKey: ["guidance-interventions", "queue", termKey],
    queryFn: ({ signal }) => fetchAllGuidanceInterventions({ signal }),
    placeholderData: keepPreviousData,
    enabled: termReady,
  });

  const allStudents = React.useMemo(
    () => (Array.isArray(data?.students) ? data.students : []),
    [data],
  );

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allStudents.filter((s: AtRiskStudentItem) => {
      if (status !== "all" && interventionStatusKey(s) !== status) return false;
      if (needle) {
        const haystack = `${s.student} ${s.lrn} ${s.section} ${
          s.intervention?.recommendedAction ?? ""
        } ${s.intervention?.assignee ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [allStudents, status, query]);

  const pager = useUrlPager(filtered.length, {}, {
    searchParam: "q",
    extraParams: ["status"],
    pageSize: GUIDANCE_INTERVENTIONS_PAGE_SIZE,
  });
  const page = pager.page;
  const setPage = pager.setPage;

  const handleQueryChange = (value: string) => {
    setQueryInput(value);
    // Local filtering is instant — only reset the pager, and skip the URL write
    // while already on page 1 so typing never triggers router churn.
    if (page !== 1) setPage(1);
  };

  const handleStatusChange = (value: InterventionStatusFilter) => {
    setStatusState(value);
    pager.setFilters({ status: value === "no_action" ? undefined : value });
  };

  const handlePageChange = (next: number) => {
    setPage(next);
  };

  // Deep-link landing: every row is already loaded, so jump to the page that
  // holds the highlighted student instead of fanning out another request.
  // The learner may not match the current status filter — reveal all statuses
  // first so the deep link never lands on an empty board.
  const locatedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!highlightId || locatedFor.current === highlightId) return;
    if (!data) return;
    locatedFor.current = highlightId;
    const idx = filtered.findIndex((s) => s.studentKey === highlightId);
    if (idx >= 0) {
      setPage(Math.floor(idx / GUIDANCE_INTERVENTIONS_PAGE_SIZE) + 1);
      return;
    }
    if (status !== "all") {
      setStatusState("all");
      pager.setFilters({ status: "all" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot deep-link landing sync
  }, [highlightId, data, filtered, status]);

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / GUIDANCE_INTERVENTIONS_PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (safePage - 1) * GUIDANCE_INTERVENTIONS_PAGE_SIZE,
    safePage * GUIDANCE_INTERVENTIONS_PAGE_SIZE,
  );

  return (
    <section className={styles.page} aria-busy={isPending || undefined}>
      {isPending ? (
        <div aria-busy="true" className={styles.feed}>
          {/* Mirrors the loaded KanbanBoard: bordered panel, header (icon/title,
              centred filter tabs, search), description, 4-col card grid, pager. */}
          <div className="flex flex-col gap-2 rounded-xl border border-border p-2.5">
            <div className="relative -mx-2.5 flex items-center gap-2 border-b border-border px-3.5 pb-2">
              <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
                <Skeleton className="size-3.5 shrink-0 rounded" />
                <Skeleton className="h-3.5 w-32" />
              </span>
              <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center">
                <Skeleton className="h-6 w-80 rounded-md" />
              </div>
              <span className="flex shrink-0 items-center justify-end gap-2">
                <Skeleton className="h-8 w-64 max-w-full rounded-2xl" />
              </span>
            </div>
            <div className="px-1">
              <Skeleton className="h-3 w-72 max-w-[90%]" />
            </div>
            <div className={styles.caseList}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((card) => (
                <div key={card} className={styles.skelCaseRow}>
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-9 shrink-0 rounded-full" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Skeleton className="h-3.5 w-3/5" />
                      <div className="flex flex-wrap gap-1">
                        <Skeleton className="h-4 w-16 rounded-md" />
                        <Skeleton className="h-4 w-10 rounded-md" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-14 shrink-0 rounded-md" />
                  </div>
                  <div className="mt-6 flex flex-wrap gap-1.5">
                    <Skeleton className="h-5 w-20 rounded-md" />
                    <Skeleton className="h-5 w-14 rounded-md" />
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-border pt-2">
                    <Skeleton className="h-4 w-16 rounded-md" />
                    <div className="flex gap-1.5">
                      <Skeleton className="size-6 rounded-md" />
                      <Skeleton className="size-6 rounded-md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.skelPager}>
              <Skeleton className={styles.skelRange} />
              <div className={styles.skelPagerBtns}>
                <Skeleton className={styles.skelPageBtn} />
                <Skeleton className={styles.skelPageLabel} />
                <Skeleton className={styles.skelPageBtn} />
              </div>
            </div>
          </div>
        </div>
      ) : isError || !data ? (
        <div className={styles.empty} role="alert">
          <p className={styles.emptyTitle}>We couldn&apos;t load the queue</p>
          <p className={styles.emptyHint}>
            Please check your internet connection and try again.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={isRefetching}
            onClick={() => refetch()}
          >
            {isRefetching ? (
              <Loader2 className={styles.spin} aria-hidden="true" />
            ) : null}
            {isRefetching ? "Loading…" : "Try again"}
          </Button>
        </div>
      ) : (data.unfilteredTotal ?? allStudents.length) === 0 ? (
        <GuidanceEmptyCard
          icon={HeartHandshake}
          title="No intervention cases"
          hint="At-risk students needing guidance follow-up will appear here."
          label="Intervention cases"
          centered
        />
      ) : (
        <GuidanceInterventionsTable
          summary={data.summary}
          students={pageRows}
          page={safePage}
          pageSize={GUIDANCE_INTERVENTIONS_PAGE_SIZE}
          total={filtered.length}
          totalPages={totalPages}
          unfilteredTotal={data.unfilteredTotal}
          onPageChange={handlePageChange}
          query={query}
          onQueryChange={handleQueryChange}
          status={status}
          onStatusChange={handleStatusChange}
          isNavigating={false}
          highlightId={highlightId}
        />
      )}
    </section>
  );
}

export default function GuidanceInterventionsPage() {
  return (
    <React.Suspense fallback={<div className={styles.page} aria-busy="true" />}>
      <GuidanceInterventionsPageInner />
    </React.Suspense>
  );
}

function GuidanceInterventionsPageInner() {
  const params = useSearchParams();
  const highlightId = params.get("highlight");
  return <GuidanceInterventionsView key={highlightId ?? "none"} highlightId={highlightId} />;
}
